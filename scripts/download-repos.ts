#!/usr/bin/env node
/**
 * Build-time script to download curated GitHub repositories
 * Uses `git clone` (shallow, single-branch) to fetch repositories
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import matter from 'gray-matter';
import {
  CURATED_REPOS,
  type CuratedRepoConfig,
  type GuideSparseExpansion,
  toRepoKey,
} from '../src/lib/curated-repos';

type ScriptOptions = {
  only: string[]; // entries like "owner/repo" or "owner/repo@branch"
  skip: string[]; // entries like "owner/repo"
  depth: number;
  list: boolean;
};

const REPOS_DIR = path.join(process.cwd(), 'public', 'repos');
const DOCS_DIR = path.join(process.cwd(), 'docs');

// Max simultaneous git clones — GitHub allows a few concurrent connections.
const DOWNLOAD_CONCURRENCY = 3;

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

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';

    if (arg === '--list') {
      list = true;
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

  return { only, skip, depth, list };
}

function parseRepoSelector(selector: string): { key: string; branchOverride?: string } {
  // "owner/repo" or "owner/repo@branch"
  const [repoPart, branchPart] = selector.split('@');
  const key = (repoPart ?? '').trim();
  const branchOverride = (branchPart ?? '').trim() || undefined;
  return { key, branchOverride };
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

/**
 * Ask the remote for the current SHA of a ref without downloading anything.
 * Returns null if the remote is unreachable or the ref is not found.
 */
async function getRemoteSHA(owner: string, repo: string, branch: string): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://github.com/${owner}/${repo}.git`;
    const child = spawn('git', ['ls-remote', url, branch], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    let output = '';
    child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const sha = output.trim().split(/\s+/)[0];
      resolve(sha || null);
    });
  });
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

/**
 * Decide whether an existing download is still current.
 *
 * Strategy:
 *   1. No manifest → must download.
 *   2. Manifest has no commitSha (legacy) → skip (presence check only).
 *   3. Manifest has commitSha → compare to live remote SHA via git ls-remote.
 *      If remote is unreachable, assume still valid and skip.
 */
async function shouldSkipDownload(
  repoDir: string,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  const manifestPath = path.join(repoDir, 'repo-manifest.json');
  if (!fs.existsSync(manifestPath)) return false;

  let storedSha: string | undefined;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    storedSha = (JSON.parse(raw) as { commitSha?: string }).commitSha;
  } catch {
    return true; // unreadable manifest — skip (will be replaced on next full clean)
  }

  if (!storedSha) {
    // Old manifest written before SHA tracking — fall back to existence check.
    return true;
  }

  if (isCommitSha(branch)) {
    return storedSha.toLowerCase() === branch.toLowerCase();
  }

  const remoteSha = await getRemoteSHA(owner, repo, branch);
  if (!remoteSha) {
    // Network unavailable — keep existing download.
    console.log(
      `   ${owner}/${repo}: remote unreachable, keeping cached (${storedSha.slice(0, 8)})`
    );
    return true;
  }

  if (remoteSha === storedSha) return true;

  console.log(
    `   ${owner}/${repo}: SHA changed ${storedSha.slice(0, 8)} → ${remoteSha.slice(0, 8)}, re-downloading`
  );
  return false;
}

function normalizeRepoPath(refPath: string): string {
  return refPath.replace(/^\/+/, '').replace(/\\/g, '/').trim();
}

function isDirectoryRef(refPath: string): boolean {
  return normalizeRepoPath(refPath).endsWith('/');
}

function getAncestorDirectories(refPath: string): string[] {
  const normalized = normalizeRepoPath(refPath).replace(/\/+$/, '');
  if (!normalized.includes('/')) {
    return [];
  }

  const parts = normalized.split('/');
  const directories: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    directories.push(parts.slice(0, i).join('/'));
  }
  return directories;
}

function toSparsePattern(refPath: string, expansion: GuideSparseExpansion): string[] {
  const normalized = normalizeRepoPath(refPath);
  if (!normalized) {
    return [];
  }

  const isDir = isDirectoryRef(normalized);
  const clean = normalized.replace(/\/+$/, '');
  const ancestors = getAncestorDirectories(clean).map((dir) => `/${dir}/`);

  if (isDir) {
    if (expansion === 'subtree') {
      return [...ancestors, `/${clean}/**`];
    }
    if (expansion === 'directory-expanded') {
      return [...ancestors, `/${clean}/*`];
    }
    return [...ancestors, `/${clean}/`];
  }

  if (expansion === 'directory-expanded') {
    const parentDir = clean.includes('/') ? clean.split('/').slice(0, -1).join('/') : '';
    if (!parentDir) {
      return [`/${clean}`];
    }
    return [...ancestors, `/${parentDir}/*`];
  }

  return [...ancestors, `/${clean}`];
}

function collectGuideReferencePaths(markdown: string): string[] {
  const refs = new Set<string>();
  const { content } = matter(markdown);
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() !== '---') {
      i++;
      continue;
    }

    i++;
    const frontmatterLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      frontmatterLines.push(lines[i]);
      i++;
    }
    if (i < lines.length) {
      i++;
    }

    const sectionFrontmatter = frontmatterLines.join('\n').trim();
    if (!sectionFrontmatter) {
      continue;
    }

    try {
      const parsed = matter(`---\n${sectionFrontmatter}\n---\n`).data as {
        fileRecommendations?: {
          docs?: Array<{ path?: string }>;
          source?: Array<{ path?: string }>;
        };
      };

      for (const bucket of ['docs', 'source'] as const) {
        for (const entry of parsed.fileRecommendations?.[bucket] ?? []) {
          const refPath = normalizeRepoPath(entry.path ?? '');
          if (refPath) {
            refs.add(refPath);
          }
        }
      }
    } catch {
      // Invalid section YAML is already handled by guide validation.
    }
  }

  return Array.from(refs);
}

function getGuidePathsForRepo(config: CuratedRepoConfig): string[] {
  const markdownFiles = fs.readdirSync(DOCS_DIR).filter((file) => file.endsWith('.md'));

  for (const file of markdownFiles) {
    const fullPath = path.join(DOCS_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const { data } = matter(raw);
    if (data.owner === config.owner && data.repo === config.repo) {
      return collectGuideReferencePaths(raw);
    }
  }

  return [];
}

function buildSparsePatterns(config: CuratedRepoConfig): string[] | null {
  const buildConfig = config.staticBuild;
  if (!buildConfig) {
    return null;
  }

  const includePatterns = new Set<string>();
  const excludePatterns = new Set<string>();
  const needsGuidePaths = buildConfig.guideMode === 'guide-only';
  const hasIncludes = (buildConfig.includeDirs?.length ?? 0) > 0;
  const hasExcludes = (buildConfig.excludeDirs?.length ?? 0) > 0;

  if (!needsGuidePaths && !hasIncludes && !hasExcludes) {
    return null;
  }

  const expansion = buildConfig.guideExpansion ?? 'directory-expanded';

  if (!needsGuidePaths && !hasIncludes) {
    includePatterns.add('/*');
  }

  if (needsGuidePaths) {
    const guidePaths = getGuidePathsForRepo(config);
    if (guidePaths.length === 0 && !hasIncludes) {
      throw new Error(
        `Guide-only sparse build requested for ${config.owner}/${config.repo}, but no guide references were found.`
      );
    }
    for (const refPath of guidePaths) {
      for (const pattern of toSparsePattern(refPath, expansion)) {
        includePatterns.add(pattern);
      }
    }
  }

  for (const includeDir of buildConfig.includeDirs ?? []) {
    const clean = normalizeRepoPath(includeDir).replace(/\/+$/, '');
    if (!clean) continue;
    for (const ancestor of getAncestorDirectories(clean)) {
      includePatterns.add(`/${ancestor}/`);
    }
    includePatterns.add(`/${clean}/**`);
  }

  for (const excludeDir of buildConfig.excludeDirs ?? []) {
    const clean = normalizeRepoPath(excludeDir).replace(/\/+$/, '');
    if (!clean) continue;
    excludePatterns.add(`!/${clean}/`);
    excludePatterns.add(`!/${clean}/**`);
  }

  const patterns = [...includePatterns, ...excludePatterns];
  return patterns.length > 0 ? patterns : null;
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
  const { owner, repo, branch } = config;
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  const parentDir = path.dirname(repoDir);
  fs.mkdirSync(parentDir, { recursive: true });

  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  const sparsePatterns = buildSparsePatterns(config);

  if (isCommitSha(branch)) {
    fs.mkdirSync(repoDir, { recursive: true });
    await runCommand('git', ['init'], repoDir);
    await runCommand('git', ['remote', 'add', 'origin', repoUrl], repoDir);

    if (sparsePatterns) {
      await runCommand(
        'git',
        ['sparse-checkout', 'set', '--no-cone', '--stdin'],
        repoDir,
        [...sparsePatterns, ''].join('\n')
      );
    }

    await runCommand(
      'git',
      ['fetch', '--depth', String(depth), '--filter=blob:none', 'origin', branch],
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
    branch,
    repoUrl,
    repoDir,
  ];

  if (sparsePatterns) {
    cloneArgs.splice(4, 0, '--sparse');
  }

  await runCommand('git', cloneArgs);

  if (sparsePatterns) {
    await runCommand(
      'git',
      ['sparse-checkout', 'set', '--no-cone', '--stdin'],
      repoDir,
      [...sparsePatterns, ''].join('\n')
    );
  }

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
 * Write manifest. `sha` is stored for future staleness checks (see shouldSkipDownload).
 */
function createManifest(repoDir: string, tree: FileNode[], sha: string | null): void {
  const manifestPath = path.join(repoDir, 'repo-manifest.json');
  const manifest: Record<string, unknown> = {
    tree: tree.map(toManifestNode),
    createdAt: new Date().toISOString(),
  };
  if (sha) manifest.commitSha = sha;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`   ✓ Manifest: ${manifestPath}`);
}

/**
 * Migrate old manifest file to new name if it exists
 */
function migrateManifestIfNeeded(repoDir: string): void {
  const oldManifestPath = path.join(repoDir, '.repo-manifest.json');
  const newManifestPath = path.join(repoDir, 'repo-manifest.json');

  if (fs.existsSync(oldManifestPath) && !fs.existsSync(newManifestPath)) {
    fs.renameSync(oldManifestPath, newManifestPath);
    console.log(`   ✓ Migrated manifest .repo-manifest.json → repo-manifest.json`);
  }
}

/**
 * Download and extract a repository
 */
async function downloadRepo(config: CuratedRepoConfig, depth: number = 1): Promise<void> {
  const { owner, repo, branch } = config;
  const repoDir = path.join(REPOS_DIR, owner, repo, branch);
  const sparsePatterns = buildSparsePatterns(config);

  console.log(`\n📦 ${owner}/${repo}@${branch}`);
  if (sparsePatterns) {
    console.log(`   ✓ Sparse checkout enabled (${sparsePatterns.length} patterns)`);
  }

  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  migrateManifestIfNeeded(repoDir);

  if (await shouldSkipDownload(repoDir, owner, repo, branch)) {
    console.log(`✅ ${owner}/${repo}@${branch} up-to-date, skipping`);
    return;
  }

  try {
    await runCommand('git', ['--version']);

    console.log(`   Cloning to: ${repoDir}`);
    const sha = await gitCloneShallow(config, repoDir, depth);
    console.log(`   ✓ Clone complete${sha ? ` (${sha.slice(0, 8)})` : ''}`);

    const { removed } = pruneNonTextFiles(repoDir);
    if (removed > 0) console.log(`   ✓ Pruned ${removed} binary files`);

    console.log(`   Building file tree...`);
    const tree = buildFileTree(repoDir);
    createManifest(repoDir, tree, sha);
    console.log(`   ✓ Tree: ${tree.length} root entries`);

    console.log(`✅ ${owner}/${repo}@${branch} ready`);
  } catch (error) {
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
    console.error(`❌ Failed ${owner}/${repo}@${branch}:`, error);
    throw error;
  }
}

const AVATARS_DIR = path.join(process.cwd(), 'public', 'avatars');

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

  const seen = new Set<string>();

  for (const repo of CURATED_REPOS) {
    const file = repo.avatarFile ?? `${repo.owner}.png`;
    const destPath = path.join(AVATARS_DIR, file);

    if (seen.has(file) || fs.existsSync(destPath)) {
      seen.add(file);
      continue;
    }
    seen.add(file);

    const url = repo.buildAvatarUrl ?? `https://github.com/${repo.owner}.png?size=256`;
    try {
      await downloadAvatar(url, destPath);
      console.log(`   ✓ Avatar: ${file}`);
    } catch (err) {
      console.warn(`   ⚠ Avatar failed (${file}): ${err}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('🚀 Starting repository download process...');
  console.log(`📁 Target directory: ${REPOS_DIR}`);
  console.log(`🌿 Clone mode: --filter=blob:none --single-branch --depth ${opts.depth}`);
  console.log(`⚡ Concurrency: ${DOWNLOAD_CONCURRENCY}`);

  if (opts.list) {
    console.log('\nCurated repos:');
    for (const r of CURATED_REPOS) {
      console.log(`- ${r.owner}/${r.repo}@${r.branch}`);
    }
    return;
  }

  console.log('\n🖼️  Downloading owner avatars...');
  await downloadAllAvatars();

  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

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

  const finalRepos = selectedRepos
    .filter((r) => !skipSet.has(toRepoKey(r.owner, r.repo)))
    .map((r) => {
      const override = branchOverrides.get(toRepoKey(r.owner, r.repo));
      return override ? { ...r, branch: override } : r;
    });

  const tasks = finalRepos.map((repo) => async () => {
    try {
      await downloadRepo(repo, opts.depth);
    } catch {
      // Error already logged inside downloadRepo; continue with remaining repos.
    }
  });

  await runWithConcurrency(tasks, DOWNLOAD_CONCURRENCY);

  console.log('\n✨ Repository download process complete!');
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
