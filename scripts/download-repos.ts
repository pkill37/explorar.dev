#!/usr/bin/env node
/**
 * Build-time script to download curated GitHub repositories
 * Uses `git clone` (shallow, single-branch) to fetch repositories
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { CURATED_REPOS, type CuratedRepoConfig, toRepoKey } from '../src/lib/curated-repos';
import { CORPUS_REPOS_DIR, PUBLIC_AVATARS_DIR } from './static-asset-paths';
import { runPhase } from './tqdm';

type ScriptOptions = {
  only: string[]; // entries like "owner/repo" or "owner/repo@revision"
  skip: string[]; // entries like "owner/repo"
  depth: number;
  list: boolean;
  avatarsOnly: boolean;
};

export type CorpusState = {
  missingAvatars: string[];
  staleRepos: string[];
  totalAvatars: number;
  totalRepos: number;
};

const REPOS_DIR = CORPUS_REPOS_DIR;

// Max simultaneous git clones — GitHub allows a few concurrent connections.
const DOWNLOAD_CONCURRENCY = 3;
const AVATAR_DOWNLOAD_CONCURRENCY = 4;

// File extensions that cannot be rendered in Monaco. Removed at clone time so
// they don't appear in the file tree or inflate the Cloudflare file count.
const BINARY_EXTENSIONS = new Set([
  '.o',
  '.a',
  '.so',
  '.dylib',
  '.dll',
  '.exe',
  '.elf',
  '.bin',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.bmp',
  '.webp',
  '.tiff',
  '.tif',
  '.svg',
  '.mp3',
  '.mp4',
  '.wav',
  '.ogg',
  '.flac',
  '.avi',
  '.mov',
  '.mkv',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.pyc',
  '.pyo',
  '.pyd',
  '.class',
  '.jar',
  '.war',
  '.wasm',
  '.bc', // LLVM bitcode (binary — distinct from .bc text source in some projects)
]);

function parseArgs(argv: string[]): ScriptOptions {
  const only: string[] = [];
  const skip: string[] = [];
  let depth = 1;
  let list = false;
  let avatarsOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';

    if (arg === '--list') {
      list = true;
      continue;
    }

    if (arg === '--avatars-only') {
      avatarsOnly = true;
      continue;
    }

    if (arg === '--only' || arg.startsWith('--only=')) {
      const value = arg.includes('=') ? arg.split('=').slice(1).join('=') : (argv[++i] ?? '');
      if (value) only.push(value);
      continue;
    }

    if (arg === '--skip' || arg.startsWith('--skip=')) {
      const value = arg.includes('=') ? arg.split('=').slice(1).join('=') : (argv[++i] ?? '');
      if (value) skip.push(value);
      continue;
    }

    if (arg === '--depth' || arg.startsWith('--depth=')) {
      const value = arg.includes('=') ? arg.split('=').slice(1).join('=') : (argv[++i] ?? '');
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid --depth value: "${value}" (expected integer >= 1)`);
      }
      depth = parsed;
      continue;
    }
  }

  return { only, skip, depth, list, avatarsOnly };
}

function parseRepoSelector(selector: string): { key: string; branchOverride?: string } {
  // "owner/repo" or "owner/repo@revision"
  const [repoPart, branchPart] = selector.split('@');
  const key = (repoPart ?? '').trim();
  const branchOverride = (branchPart ?? '').trim() || undefined;
  return { key, branchOverride };
}

function selectRepos(opts: ScriptOptions): CuratedRepoConfig[] {
  const skipSet = new Set(opts.skip.map((s) => parseRepoSelector(s).key));
  const onlySelectors = opts.only.map((s) => parseRepoSelector(s));
  const onlyKeySet = new Set(onlySelectors.map((s) => s.key));
  const branchOverrides = new Map(
    onlySelectors.filter((s) => s.branchOverride).map((s) => [s.key, s.branchOverride!] as const)
  );

  const selectedRepos: CuratedRepoConfig[] =
    opts.only.length > 0
      ? CURATED_REPOS.filter((r) => onlyKeySet.has(toRepoKey(r.owner, r.repo)))
      : [...CURATED_REPOS];

  return selectedRepos
    .filter((r) => !skipSet.has(toRepoKey(r.owner, r.repo)))
    .map((r) => {
      const override = branchOverrides.get(toRepoKey(r.owner, r.repo));
      return override ? { ...r, ref: override, revision: override } : r;
    });
}

function isCommitSha(ref: string): boolean {
  return /^[0-9a-f]{40}$/i.test(ref);
}

/**
 * Run a command and resolve on exit 0. Output is piped (not inherited) so
 * parallel invocations don't produce interleaved terminal noise; stderr is
 * captured and included in the thrown error on failure.
 */
async function runCommand(
  cmd: string,
  args: string[],
  cwd?: string,
  stdin?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    } else {
      child.stdin?.end();
    }

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${stderr.trim()}`));
    });
  });
}

/**
 * Run tasks with bounded concurrency. Each element of `tasks` is a
 * zero-argument async function; at most `limit` run simultaneously.
 */
async function runWithConcurrency(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  const queue = [...tasks];
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      await queue.shift()!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

/** Read HEAD commit SHA from an already-cloned (still has .git) directory. */
async function getLocalSHA(repoDir: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', repoDir, 'rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let output = '';
    child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? output.trim() || null : null));
  });
}

function getBuildSignature(config: CuratedRepoConfig): string {
  return JSON.stringify({
    id: config.id,
    owner: config.owner,
    repo: config.repo,
    ref: config.ref,
    revision: config.revision,
    guideId: config.guideId,
  });
}

/**
 * Decide whether an existing download is still current.
 *
 * Strategy:
 *   1. No manifest → must download.
 *   2. Manifest missing buildSignature → re-download once to migrate.
 *   3. Manifest buildSignature differs from current build inputs → re-download.
 *
 * This intentionally does not consult the remote repository. The download
 * pipeline is pinned to immutable refs, so freshness is derived from local
 * build inputs only.
 */
async function shouldSkipDownload(repoDir: string, config: CuratedRepoConfig): Promise<boolean> {
  const manifestPath = path.join(repoDir, 'repo-manifest.json');
  if (!fs.existsSync(manifestPath)) return false;

  let storedSignature: string | undefined;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    storedSignature = (JSON.parse(raw) as { buildSignature?: string }).buildSignature;
  } catch {
    return false;
  }

  if (!storedSignature) {
    return false;
  }

  return storedSignature === getBuildSignature(config);
}

export async function inspectCorpusState(opts: ScriptOptions): Promise<CorpusState> {
  const repos = selectRepos(opts);
  const avatarTargets = new Set(repos.map((repo) => repo.avatarFile ?? `${repo.owner}.png`));
  const missingAvatars = [...avatarTargets].filter(
    (file) => !fs.existsSync(path.join(AVATARS_DIR, file))
  );

  const staleRepos: string[] = [];
  for (const repo of repos) {
    const repoDir = path.join(REPOS_DIR, repo.owner, repo.repo, repo.revision);
    const isCurrent = await shouldSkipDownload(repoDir, repo);
    if (!isCurrent) {
      staleRepos.push(`${repo.owner}/${repo.repo}@${repo.revision}`);
    }
  }

  return {
    missingAvatars,
    staleRepos,
    totalAvatars: avatarTargets.size,
    totalRepos: repos.length,
  };
}

function pruneStaleBranchDownloads(repos: CuratedRepoConfig[]): void {
  const allowedBranchesByRepo = new Map<string, Set<string>>();

  for (const repo of repos) {
    const key = toRepoKey(repo.owner, repo.repo);
    const allowed = allowedBranchesByRepo.get(key) ?? new Set<string>();
    allowed.add(repo.revision);
    allowedBranchesByRepo.set(key, allowed);
  }

  for (const [repoKey, allowedBranches] of allowedBranchesByRepo) {
    const [owner, repo] = repoKey.split('/');
    if (!owner || !repo) continue;

    const repoRoot = path.join(REPOS_DIR, owner, repo);
    if (!fs.existsSync(repoRoot)) continue;

    for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (allowedBranches.has(entry.name)) continue;

      const stalePath = path.join(repoRoot, entry.name);
      fs.rmSync(stalePath, { recursive: true, force: true });
      console.log(`Pruned stale repo download: ${owner}/${repo}@${entry.name}`);
    }
  }
}

/**
 * Clone a repository (single branch, shallow, partial) into a directory.
 * Returns the HEAD commit SHA recorded before .git is removed.
 *
 * Uses partial clone (--filter=blob:none) to reduce download size:
 * - Only downloads tree metadata (directory structure, file names, modes)
 * - Skips actual file contents (blobs)
 * - Reduces size by 80%+ for large repos (linux: 1.2GB → 200MB)
 * - Sufficient since we only need tree structure for the manifest
 */
async function gitCloneShallow(
  config: CuratedRepoConfig,
  repoDir: string,
  depth: number
): Promise<string | null> {
  const { owner, repo, revision } = config;
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  const parentDir = path.dirname(repoDir);
  fs.mkdirSync(parentDir, { recursive: true });

  const repoUrl = `https://github.com/${owner}/${repo}.git`;

  if (isCommitSha(revision)) {
    fs.mkdirSync(repoDir, { recursive: true });
    await runCommand('git', ['init'], repoDir);
    await runCommand('git', ['remote', 'add', 'origin', repoUrl], repoDir);

    await runCommand(
      'git',
      ['fetch', '--depth', String(depth), '--filter=blob:none', 'origin', revision],
      repoDir
    );
    await runCommand('git', ['checkout', '--detach', 'FETCH_HEAD'], repoDir);

    const sha = await getLocalSHA(repoDir);
    const gitDir = path.join(repoDir, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    return sha;
  }

  const cloneArgs = [
    '-c',
    'advice.detachedHead=false',
    'clone',
    '--filter=blob:none',
    '--depth',
    String(depth),
    '--single-branch',
    '--branch',
    revision,
    repoUrl,
    repoDir,
  ];

  await runCommand('git', cloneArgs);

  // Capture SHA before deleting .git — used for future staleness checks.
  const sha = await getLocalSHA(repoDir);

  const gitDir = path.join(repoDir, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  return sha;
}

// Full in-memory node (name + path for convenience during build)
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

// Compact node written to manifest – no redundant path/size fields
interface ManifestNode {
  name: string;
  type: 'f' | 'd';
  children?: ManifestNode[];
}

/**
 * Walk `dir` and delete files whose extension is in BINARY_EXTENSIONS.
 * Returns counts for the build log.
 */
function pruneNonTextFiles(dir: string): { removed: number } {
  let removed = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += pruneNonTextFiles(full).removed;
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        fs.rmSync(full);
        removed++;
      }
    }
  }
  return { removed };
}

/**
 * Build file tree structure from directory
 */
function buildFileTree(dirPath: string, basePath: string = ''): FileNode[] {
  const nodes: FileNode[] = [];

  if (!fs.existsSync(dirPath)) {
    return nodes;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  // Sort: directories first, then files
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (entry.name === '.git') continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = buildFileTree(fullPath, relativePath);
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      });
    }
  }

  return nodes;
}

function toManifestNode(node: FileNode): ManifestNode {
  const result: ManifestNode = { name: node.name, type: node.type === 'directory' ? 'd' : 'f' };
  if (node.children) {
    result.children = node.children.map(toManifestNode);
  }
  return result;
}

/**
 * Write manifest with the current build signature.
 */
function createManifest(repoDir: string, tree: FileNode[], buildSignature: string): void {
  const manifestPath = path.join(repoDir, 'repo-manifest.json');
  const manifest: Record<string, unknown> = {
    tree: tree.map(toManifestNode),
    createdAt: new Date().toISOString(),
    buildSignature,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`   Manifest: ${manifestPath}`);
}

/**
 * Download and extract a repository
 */
async function downloadRepo(config: CuratedRepoConfig, depth: number = 1): Promise<void> {
  const { owner, repo, revision } = config;
  const repoDir = path.join(REPOS_DIR, owner, repo, revision);
  const buildSignature = getBuildSignature(config);

  console.log(`\nRepo ${owner}/${repo}@${revision}`);

  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  if (await shouldSkipDownload(repoDir, config)) {
    console.log(`skip: ${owner}/${repo}@${revision} pinned build matches`);
    return;
  }

  try {
    await runCommand('git', ['--version']);

    console.log(`   Cloning to: ${repoDir}`);
    const sha = await gitCloneShallow(config, repoDir, depth);
    console.log(`   Clone complete${sha ? ` (${sha.slice(0, 8)})` : ''}`);

    const { removed } = pruneNonTextFiles(repoDir);
    if (removed > 0) console.log(`   Pruned ${removed} binary files`);

    console.log(`   Building file tree...`);
    const tree = buildFileTree(repoDir);
    createManifest(repoDir, tree, buildSignature);
    console.log(`   Tree: ${tree.length} root entries`);

    console.log(`ready: ${owner}/${repo}@${revision}`);
  } catch (error) {
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
    console.error(`ERROR ${owner}/${repo}@${revision}:`, error);
    throw error;
  }
}

const AVATARS_DIR = PUBLIC_AVATARS_DIR;

async function downloadAvatar(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'explorar.dev-build/1.0 (https://github.com/pkill37/explorar.dev)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function downloadAllAvatars(): Promise<void> {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });

  const avatarTargets = new Map<string, { file: string; url: string }>();
  for (const repo of CURATED_REPOS) {
    const file = repo.avatarFile ?? `${repo.owner}.png`;
    if (!avatarTargets.has(file)) {
      avatarTargets.set(file, {
        file,
        url: repo.buildAvatarUrl ?? `https://github.com/${repo.owner}.png?size=256`,
      });
    }
  }

  const uniqueTargets = [...avatarTargets.values()];
  const uniqueAvatarCount = uniqueTargets.length;
  let processed = 0;
  console.log(`   Preparing ${uniqueAvatarCount} unique avatar targets`);

  const tasks = uniqueTargets.map(({ file, url }) => async () => {
    const destPath = path.join(AVATARS_DIR, file);

    try {
      if (fs.existsSync(destPath)) {
        processed++;
        console.log(`   [${processed}/${uniqueAvatarCount}] Avatar cached: ${file}`);
        return;
      }

      await downloadAvatar(url, destPath);
      processed++;
      console.log(`   [${processed}/${uniqueAvatarCount}] Avatar downloaded: ${file}`);
    } catch (err) {
      processed++;
      console.warn(`   [${processed}/${uniqueAvatarCount}] Avatar failed (${file}): ${err}`);
    }
  });

  await runWithConcurrency(tasks, AVATAR_DOWNLOAD_CONCURRENCY);
  console.log(`   Avatar pass complete: ${processed}/${uniqueAvatarCount}`);
}

/**
 * Main function
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('Repository download process starting...');
  console.log(`Target directory: ${REPOS_DIR}`);
  console.log(`Clone mode: --filter=blob:none --single-branch --depth ${opts.depth}`);
  console.log(`Concurrency: ${DOWNLOAD_CONCURRENCY}`);

  if (opts.list) {
    console.log('\nCurated repos:');
    for (const r of CURATED_REPOS) {
      console.log(`- ${r.owner}/${r.repo}@${r.revision}`);
    }
    return;
  }

  await runPhase(
    '🖼️ Avatar fetch',
    async () => {
      console.log('\nDownloading owner avatars...');
      await downloadAllAvatars();
    },
    `${CURATED_REPOS.length} curated repos`
  );

  if (opts.avatarsOnly) {
    console.log('\nRepository download process complete.');
    return;
  }

  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }
  const finalRepos = selectRepos(opts);

  await runPhase(
    '🧹 Prune stale branches',
    () => {
      pruneStaleBranchDownloads(finalRepos);
    },
    `${finalRepos.length} repo targets`
  );

  console.log('\nFinal curated repo plan:');
  for (const repo of finalRepos) {
    console.log(`   - ${repo.owner}/${repo.repo}@${repo.revision}`);
  }

  let completedRepos = 0;
  const tasks = finalRepos.map((repo) => async () => {
    try {
      console.log(`\n   Starting ${repo.owner}/${repo.repo}@${repo.revision}`);
      await downloadRepo(repo, opts.depth);
    } catch {
      // Error already logged inside downloadRepo; continue with remaining repos.
    } finally {
      completedRepos++;
      console.log(`   Progress: ${completedRepos}/${finalRepos.length} repos processed`);
    }
  });

  await runPhase(
    '📦 Curated repo sync',
    async () => {
      await runWithConcurrency(tasks, DOWNLOAD_CONCURRENCY);
    },
    `${finalRepos.length} repos @ concurrency ${DOWNLOAD_CONCURRENCY}`
  );

  console.log('\nRepository download process complete.');
}

import { fileURLToPath } from 'url';
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { downloadRepo, CURATED_REPOS };
