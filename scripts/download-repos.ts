#!/usr/bin/env node
/**
 * Build-time script to download curated GitHub repositories
 * Uses `git clone` (shallow, single-branch) to fetch repositories
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

type ScriptOptions = {
  only: string[]; // entries like "owner/repo" or "owner/repo@branch"
  skip: string[]; // entries like "owner/repo"
  depth: number;
  list: boolean;
};

const CURATED_REPOS: RepoConfig[] = [
  { owner: 'torvalds', repo: 'linux', branch: 'v6.1' },
  { owner: 'python', repo: 'cpython', branch: 'v3.12.0' },
  { owner: 'bminor', repo: 'glibc', branch: 'glibc-2.39' },
  { owner: 'llvm', repo: 'llvm-project', branch: 'llvmorg-18.1.0' },
  { owner: 'apple-oss-distributions', repo: 'xnu', branch: 'xnu-12377.1.9' },
];

const REPOS_DIR = path.join(process.cwd(), 'public', 'repos');

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

function toRepoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function parseRepoSelector(selector: string): { key: string; branchOverride?: string } {
  // "owner/repo" or "owner/repo@branch"
  const [repoPart, branchPart] = selector.split('@');
  const key = (repoPart ?? '').trim();
  const branchOverride = (branchPart ?? '').trim() || undefined;
  return { key, branchOverride };
}

/**
 * Run a command (streaming stdio) and resolve on exit 0.
 */
async function runCommand(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Never prompt for credentials during builds.
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}`));
    });
  });
}

/**
 * Clone a repository (single branch, shallow) into a directory.
 */
async function gitCloneShallow(
  owner: string,
  repo: string,
  branch: string,
  repoDir: string,
  depth: number
): Promise<void> {
  // Clone into an empty/non-existent directory.
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  const parentDir = path.dirname(repoDir);
  fs.mkdirSync(parentDir, { recursive: true });

  const repoUrl = `https://github.com/${owner}/${repo}.git`;

  await runCommand('git', [
    '-c',
    'advice.detachedHead=false',
    'clone',
    '--depth',
    String(depth),
    '--single-branch',
    '--branch',
    branch,
    repoUrl,
    repoDir,
  ]);

  // Remove VCS metadata so we only ship the source tree.
  const gitDir = path.join(repoDir, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
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
    // Skip .git directory but allow all other dotfiles
    if (entry.name === '.git') {
      continue;
    }

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
      const stats = fs.statSync(fullPath);
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        size: stats.size,
      });
    }
  }

  return nodes;
}

/**
 * Create manifest file with tree structure
 */
function createManifest(repoDir: string, tree: FileNode[]): void {
  const manifestPath = path.join(repoDir, 'repo-manifest.json');
  const manifest = {
    tree,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✓ Manifest created: ${manifestPath}`);
}

/**
 * Migrate old manifest file to new name if it exists
 */
function migrateManifestIfNeeded(repoDir: string): void {
  const oldManifestPath = path.join(repoDir, '.repo-manifest.json');
  const newManifestPath = path.join(repoDir, 'repo-manifest.json');

  if (fs.existsSync(oldManifestPath) && !fs.existsSync(newManifestPath)) {
    fs.renameSync(oldManifestPath, newManifestPath);
    console.log(`   ✓ Migrated manifest from .repo-manifest.json to repo-manifest.json`);
  }
}

/**
 * Download and extract a repository
 */
async function downloadRepo(config: RepoConfig, depth: number = 1): Promise<void> {
  const { owner, repo, branch } = config;
  const repoDir = path.join(REPOS_DIR, owner, repo, branch);

  console.log(`\n📦 Fetching ${owner}/${repo}@${branch}...`);

  // Create directory if it doesn't exist
  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  // Check if already downloaded (check for manifest file - new or old name)
  const newManifestPath = path.join(repoDir, 'repo-manifest.json');
  const oldManifestPath = path.join(repoDir, '.repo-manifest.json');

  if (fs.existsSync(newManifestPath)) {
    console.log(`✅ ${owner}/${repo}@${branch} already exists, skipping...`);
    return;
  }

  // Migrate old manifest if it exists
  if (fs.existsSync(oldManifestPath)) {
    migrateManifestIfNeeded(repoDir);
    console.log(`✅ ${owner}/${repo}@${branch} already exists (migrated), skipping...`);
    return;
  }

  try {
    // Ensure `git` is available before we do work.
    await runCommand('git', ['--version']);

    console.log(`   Cloning to: ${repoDir}`);
    await gitCloneShallow(owner, repo, branch, repoDir, depth);
    console.log(`   ✓ Clone complete (shallow, single-branch)`);

    // Build tree structure and create manifest
    console.log(`   Building file tree...`);
    const tree = buildFileTree(repoDir);
    createManifest(repoDir, tree);
    console.log(`   ✓ Tree structure created (${tree.length} root items)`);

    console.log(`✅ ${owner}/${repo}@${branch} ready!`);
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    console.error(`❌ Failed to download ${owner}/${repo}@${branch}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('🚀 Starting repository download process...');
  console.log(`📁 Target directory: ${REPOS_DIR}`);
  console.log(`🌿 Clone mode: --single-branch --depth ${opts.depth}`);

  if (opts.list) {
    console.log('\nCurated repos:');
    for (const r of CURATED_REPOS) {
      console.log(`- ${r.owner}/${r.repo}@${r.branch}`);
    }
    return;
  }

  // Ensure repos directory exists
  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  // Filter curated repos based on CLI selectors
  const skipSet = new Set(opts.skip.map((s) => parseRepoSelector(s).key));
  const onlySelectors = opts.only.map((s) => parseRepoSelector(s));
  const onlyKeySet = new Set(onlySelectors.map((s) => s.key));
  const branchOverrides = new Map(
    onlySelectors.filter((s) => s.branchOverride).map((s) => [s.key, s.branchOverride!] as const)
  );

  const selectedRepos: RepoConfig[] =
    opts.only.length > 0
      ? CURATED_REPOS.filter((r) => onlyKeySet.has(toRepoKey(r.owner, r.repo)))
      : [...CURATED_REPOS];

  const finalRepos = selectedRepos
    .filter((r) => !skipSet.has(toRepoKey(r.owner, r.repo)))
    .map((r) => {
      const override = branchOverrides.get(toRepoKey(r.owner, r.repo));
      return override ? { ...r, branch: override } : r;
    });

  // Download selected curated repos
  for (const repo of finalRepos) {
    try {
      await downloadRepo(repo, opts.depth);
    } catch (error) {
      console.error(`Failed to download ${repo.owner}/${repo.repo}:`, error);
      // Continue with other repos even if one fails
    }
  }

  console.log('\n✨ Repository download process complete!');
}

// Run if executed directly
import { fileURLToPath } from 'url';
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { downloadRepo, CURATED_REPOS };
