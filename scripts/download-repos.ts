#!/usr/bin/env node
/**
 * Build-time script to download curated GitHub repositories
 * Uses `git clone` (shallow, single-branch) to fetch repositories
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { CURATED_REPOS, type CuratedRepoConfig, toRepoKey } from '../src/lib/curated-repos';
import {
  buildCodeIndex,
  type CodeIndexBuildLogger,
  type CodeIndexBuildStats,
} from './code-index-builder';
import { getCorpusBuildSignature, type CorpusBuildTreeNode } from './corpus-build-signature';
import { CORPUS_REPOS_DIR } from './static-asset-paths';
import { runPhase } from './tqdm';

type ScriptOptions = {
  only: string[]; // entries like "owner/repo" or "owner/repo@revision"
  skip: string[]; // entries like "owner/repo"
  depth: number;
  list: boolean;
};

export type CorpusState = {
  staleRepos: string[];
  totalRepos: number;
};

type RepoCodeIndexStats = CodeIndexBuildStats & {
  owner: string;
  repo: string;
  revision: string;
};

type CodeIndexRunStats = {
  repoCount: number;
  totalDurationMs: number;
  totalFileCount: number;
  totalSymbolCount: number;
  totalEdgeCount: number;
  totalTruncatedFileCount: number;
  repos: RepoCodeIndexStats[];
};

type BuildLogger = CodeIndexBuildLogger & {
  error: (message: string) => void;
  flush: () => void;
};

const REPOS_DIR = CORPUS_REPOS_DIR;

// Max simultaneous git clones — GitHub allows a few concurrent connections.
const DOWNLOAD_CONCURRENCY = 3;
const DEFAULT_CODE_INDEX_CONCURRENCY = 1;
const DEFAULT_GIT_RETRY_ATTEMPTS = 3;
const DEFAULT_GIT_RETRY_BASE_DELAY_MS = 2_000;

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
  stdin?: string,
  extraEnv?: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...extraEnv,
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

function readPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid ${name}: expected a positive integer, received "${rawValue}"`);
  }

  return parsed;
}

function getGitRetryAttempts(): number {
  return readPositiveIntEnv('GIT_DOWNLOAD_RETRY_ATTEMPTS', DEFAULT_GIT_RETRY_ATTEMPTS);
}

function getGitRetryBaseDelayMs(): number {
  return readPositiveIntEnv('GIT_DOWNLOAD_RETRY_BASE_DELAY_MS', DEFAULT_GIT_RETRY_BASE_DELAY_MS);
}

function getCodeIndexConcurrency(): number {
  return readPositiveIntEnv('CODE_INDEX_CONCURRENCY', DEFAULT_CODE_INDEX_CONCURRENCY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fmtDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function summarizeCodeIndexStats(repos: RepoCodeIndexStats[]): CodeIndexRunStats {
  return {
    repoCount: repos.length,
    totalDurationMs: repos.reduce((total, repo) => total + repo.durationMs, 0),
    totalFileCount: repos.reduce((total, repo) => total + repo.fileCount, 0),
    totalSymbolCount: repos.reduce((total, repo) => total + repo.symbolCount, 0),
    totalEdgeCount: repos.reduce((total, repo) => total + repo.edgeCount, 0),
    totalTruncatedFileCount: repos.reduce((total, repo) => total + repo.truncatedFileCount, 0),
    repos,
  };
}

function writeCodeIndexStats(stats: CodeIndexRunStats): void {
  const outputPath = process.env.CODE_INDEX_STATS_PATH?.trim();
  if (!outputPath) {
    return;
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(stats, null, 2)}\n`);
}

async function runWithRetries<T>(
  label: string,
  operation: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
  logger: Pick<BuildLogger, 'warn'> = console
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `   ${label} failed on attempt ${attempt}/${attempts}: ${message}. Retrying in ${(
          delayMs / 1000
        ).toFixed(delayMs >= 10_000 ? 0 : 1)}s...`
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

let activeCodeIndexBuilds = 0;
const pendingCodeIndexBuilds: Array<() => void> = [];

async function acquireCodeIndexSlot(): Promise<() => void> {
  const limit = getCodeIndexConcurrency();
  if (activeCodeIndexBuilds >= limit) {
    await new Promise<void>((resolve) => {
      pendingCodeIndexBuilds.push(resolve);
    });
  }

  activeCodeIndexBuilds++;
  return () => {
    activeCodeIndexBuilds--;
    pendingCodeIndexBuilds.shift()?.();
  };
}

async function buildCodeIndexWithLimit(
  repoDir: string,
  tree: FileNode[],
  buildSignature: string,
  logger: CodeIndexBuildLogger
): Promise<CodeIndexBuildStats> {
  const release = await acquireCodeIndexSlot();
  try {
    return buildCodeIndex(repoDir, tree, buildSignature, logger);
  } finally {
    release();
  }
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
  let manifestTree: CorpusBuildTreeNode[] | undefined;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as { buildSignature?: string; tree?: CorpusBuildTreeNode[] };
    storedSignature = manifest.buildSignature;
    manifestTree = manifest.tree;
  } catch {
    return false;
  }

  if (!storedSignature || !Array.isArray(manifestTree)) {
    return false;
  }

  return storedSignature === getCorpusBuildSignature(config, manifestTree);
}

export async function inspectCorpusState(opts: ScriptOptions): Promise<CorpusState> {
  const repos = selectRepos(opts);

  const staleRepos: string[] = [];
  for (const repo of repos) {
    const repoDir = path.join(REPOS_DIR, repo.owner, repo.repo, repo.revision);
    const isCurrent = await shouldSkipDownload(repoDir, repo);
    if (!isCurrent) {
      staleRepos.push(`${repo.owner}/${repo.repo}@${repo.revision}`);
    }
  }

  return {
    staleRepos,
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
  depth: number,
  logger: Pick<BuildLogger, 'warn'>
): Promise<string | null> {
  const { owner, repo, revision } = config;
  const parentDir = path.dirname(repoDir);
  fs.mkdirSync(parentDir, { recursive: true });

  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  const retryAttempts = getGitRetryAttempts();
  const retryBaseDelayMs = getGitRetryBaseDelayMs();

  const removePartialCheckout = () => {
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  };

  const cloneOnce = async (): Promise<string | null> => {
    removePartialCheckout();

    if (isCommitSha(revision)) {
      fs.mkdirSync(repoDir, { recursive: true });
      await runCommand('git', ['init'], repoDir);
      await runCommand('git', ['remote', 'add', 'origin', repoUrl], repoDir);

      await runCommand(
        'git',
        [
          '-c',
          'http.version=HTTP/1.1',
          'fetch',
          '--depth',
          String(depth),
          '--filter=blob:none',
          'origin',
          revision,
        ],
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
      '-c',
      'http.version=HTTP/1.1',
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
  };

  return runWithRetries(
    `git clone ${owner}/${repo}@${revision}`,
    cloneOnce,
    retryAttempts,
    retryBaseDelayMs,
    logger
  );
}

function createRepoLogger(): BuildLogger {
  const lines: string[] = [];

  return {
    log(message: string) {
      lines.push(message);
    },
    warn(message: string) {
      lines.push(message);
    },
    error(message: string) {
      lines.push(message);
    },
    flush() {
      if (lines.length === 0) {
        return;
      }
      console.log(lines.join('\n'));
      lines.length = 0;
    },
  };
}

const immediateLogger: BuildLogger = {
  log(message: string) {
    console.log(message);
  },
  warn(message: string) {
    console.warn(message);
  },
  error(message: string) {
    console.error(message);
  },
  flush() {},
};

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
function createManifest(
  repoDir: string,
  tree: FileNode[],
  buildSignature: string,
  logger: Pick<BuildLogger, 'log'>
): void {
  const manifestPath = path.join(repoDir, 'repo-manifest.json');
  const manifest: Record<string, unknown> = {
    tree: tree.map(toManifestNode),
    createdAt: new Date().toISOString(),
    buildSignature,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  logger.log(`   Manifest: ${manifestPath}`);
}

/**
 * Download and extract a repository
 */
async function downloadRepo(
  config: CuratedRepoConfig,
  depth: number = 1,
  logger: BuildLogger = immediateLogger
): Promise<RepoCodeIndexStats | null> {
  const { owner, repo, revision } = config;
  const repoDir = path.join(REPOS_DIR, owner, repo, revision);
  logger.log(`\nRepo ${owner}/${repo}@${revision}`);

  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  if (await shouldSkipDownload(repoDir, config)) {
    logger.log(`skip: ${owner}/${repo}@${revision} pinned build matches`);
    return null;
  }

  try {
    await runCommand('git', ['--version']);

    logger.log(`   Cloning to: ${repoDir}`);
    const sha = await gitCloneShallow(config, repoDir, depth, logger);
    logger.log(`   Clone complete${sha ? ` (${sha.slice(0, 8)})` : ''}`);

    const { removed } = pruneNonTextFiles(repoDir);
    if (removed > 0) logger.log(`   Pruned ${removed} binary files`);

    logger.log(`   Building file tree...`);
    const tree = buildFileTree(repoDir);
    const buildSignature = getCorpusBuildSignature(config, tree);
    createManifest(repoDir, tree, buildSignature, logger);
    const codeIndexStats = await buildCodeIndexWithLimit(repoDir, tree, buildSignature, logger);
    logger.log(`   Tree: ${tree.length} root entries`);

    logger.log(`ready: ${owner}/${repo}@${revision}`);
    return {
      ...codeIndexStats,
      owner,
      repo,
      revision,
    };
  } catch (error) {
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
    const message = error instanceof Error ? error.stack || error.message : String(error);
    logger.error(`ERROR ${owner}/${repo}@${revision}: ${message}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('Repository download process starting...');
  console.log(`Target directory: ${REPOS_DIR}`);
  console.log(`Clone mode: --filter=blob:none --single-branch --depth ${opts.depth}`);
  console.log(`Clone concurrency: ${DOWNLOAD_CONCURRENCY}`);
  console.log(`Code index concurrency: ${getCodeIndexConcurrency()}`);
  console.log(
    `Retry policy: ${getGitRetryAttempts()} attempt(s) with exponential backoff from ${getGitRetryBaseDelayMs()}ms`
  );

  if (opts.list) {
    console.log('\nCurated repos:');
    for (const r of CURATED_REPOS) {
      console.log(`- ${r.owner}/${r.repo}@${r.revision}`);
    }
    return;
  }

  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }
  const finalRepos = selectRepos(opts);
  const codeIndexStats: RepoCodeIndexStats[] = [];

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
    const logger = createRepoLogger();
    try {
      logger.log(`\nStarting ${repo.owner}/${repo.repo}@${repo.revision}`);
      const stats = await downloadRepo(repo, opts.depth, logger);
      if (stats) {
        codeIndexStats.push(stats);
      }
    } catch {
      // Error already logged inside the repo transcript; continue with remaining repos.
    } finally {
      logger.flush();
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

  const summary = summarizeCodeIndexStats(codeIndexStats);
  writeCodeIndexStats(summary);
  if (summary.repoCount > 0) {
    console.log(
      `\nCode indexing total: ${fmtDuration(summary.totalDurationMs)} across ${summary.repoCount} repo(s), ${summary.totalFileCount} files, ${summary.totalSymbolCount} symbols, ${summary.totalEdgeCount} edges`
    );
  } else {
    console.log('\nCode indexing total: 0s (no repos indexed; corpus cache current)');
  }

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
