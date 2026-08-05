#!/usr/bin/env node
/**
 * Deploy curated corpus assets to Cloudflare R2.
 *
 * R2 only needs the bucket-backed curated corpus:
 * - sync `repos/` into `repos/`
 * - use the Cloudflare R2 S3-compatible endpoint
 * - upload only changed objects, never mirror-delete the bucket
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadDeployEnv } from './deploy-env';
import { getCorpusBuildSignature, type CorpusBuildTreeNode } from './corpus-build-signature';
import { CORPUS_REPOS_DIR, MAN_PAGES_DIR } from './static-asset-paths';
import { CURATED_REPOS } from '../src/lib/curated-repos';
import { runPhase } from './tqdm';

type DeployEnv = {
  bucketName: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type RepoManifest = {
  buildSignature?: string;
  tree?: CorpusBuildTreeNode[];
};

const R2_SYNC_CONCURRENCY = 2;
const DEFAULT_R2_RETRY_ATTEMPTS = 3;
const DEFAULT_R2_RETRY_BASE_DELAY_MS = 2_000;
const R2_SYNC_COMPARISON_ARGS = ['--size-only'] as const;

export function fail(message: string): never {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

export function readR2Env(): DeployEnv {
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!bucketName) fail('Missing R2_BUCKET_NAME');
  if (!accountId) fail('Missing CLOUDFLARE_ACCOUNT_ID');
  if (!accessKeyId) fail('Missing R2_ACCESS_KEY_ID');
  if (!secretAccessKey) fail('Missing R2_SECRET_ACCESS_KEY');

  return { bucketName, accountId, accessKeyId, secretAccessKey };
}

export function ensureOutDir(): void {
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fail('The `out/` directory does not exist. Run `npm run build` first.');
  }
}

function ensureCorpusDir(dirPath: string, label: string): void {
  if (!fs.existsSync(dirPath)) {
    fail(
      `The ${label} directory does not exist at ${dirPath}. Run \`tsx scripts/download-repos.ts\` first.`
    );
  }
}

function runAwsCommand(args: string[], env: DeployEnv, failureContext: string) {
  const endpointUrl = `https://${env.accountId}.r2.cloudflarestorage.com`;
  const argsWithEndpoint = [...args, '--endpoint-url', endpointUrl];

  const result = spawnSync('aws', argsWithEndpoint, {
    stdio: 'inherit',
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: env.accessKeyId,
      AWS_SECRET_ACCESS_KEY: env.secretAccessKey,
      AWS_DEFAULT_REGION: 'auto',
    },
  });

  if (result.error) {
    fail(`Failed to launch aws CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${failureContext} (aws exited with status ${result.status ?? 'unknown'})`);
  }
}

function runAwsCommandAsync(args: string[], env: DeployEnv, failureContext: string): Promise<void> {
  const endpointUrl = `https://${env.accountId}.r2.cloudflarestorage.com`;
  const argsWithEndpoint = [...args, '--endpoint-url', endpointUrl];

  return new Promise((resolve, reject) => {
    const child = spawn('aws', argsWithEndpoint, {
      stdio: 'inherit',
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: env.accessKeyId,
        AWS_SECRET_ACCESS_KEY: env.secretAccessKey,
        AWS_DEFAULT_REGION: 'auto',
      },
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to launch aws CLI: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${failureContext} (aws exited with status ${code ?? 'unknown'})`));
    });
  });
}

function runAwsHeadObjectQuiet(bucketName: string, key: string, env: DeployEnv): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'aws',
      [
        's3api',
        'head-object',
        '--bucket',
        bucketName,
        '--key',
        key,
        '--endpoint-url',
        `https://${env.accountId}.r2.cloudflarestorage.com`,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: env.accessKeyId,
          AWS_SECRET_ACCESS_KEY: env.secretAccessKey,
          AWS_DEFAULT_REGION: 'auto',
        },
      }
    );

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to launch aws CLI: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }

      if (code === 254 || code === 1) {
        resolve(false);
        return;
      }

      reject(new Error(`aws exited with status ${code ?? 'unknown'}: ${stderr.trim()}`));
    });
  });
}

function runAwsCommandCaptureStdout(args: string[], env: DeployEnv): Promise<string> {
  const endpointUrl = `https://${env.accountId}.r2.cloudflarestorage.com`;
  const argsWithEndpoint = [...args, '--endpoint-url', endpointUrl];

  return new Promise((resolve, reject) => {
    const child = spawn('aws', argsWithEndpoint, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: env.accessKeyId,
        AWS_SECRET_ACCESS_KEY: env.secretAccessKey,
        AWS_DEFAULT_REGION: 'auto',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to launch aws CLI: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`aws exited with status ${code ?? 'unknown'}: ${stderr.trim()}`));
    });
  });
}

function readCurrentBuildSignatureFromManifestFile(
  manifestPath: string,
  repo: { id: string; owner: string; repo: string; ref: string; revision: string; guideId: string }
): string | null {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as RepoManifest;
    if (!Array.isArray(manifest.tree)) {
      return null;
    }

    return getCorpusBuildSignature(repo, manifest.tree);
  } catch {
    return null;
  }
}

export function buildRepoBucketPrefix(
  bucketName: string,
  repo: { owner: string; repo: string; revision: string }
): string {
  return `s3://${bucketName}/repos/${repo.owner}/${repo.repo}/${repo.revision}/`;
}

export function buildRepoManifestKey(repo: {
  owner: string;
  repo: string;
  revision: string;
}): string {
  return `repos/${repo.owner}/${repo.repo}/${repo.revision}/repo-manifest.json`;
}

export function buildRepoCodeIndexKey(repo: {
  owner: string;
  repo: string;
  revision: string;
}): string {
  return `repos/${repo.owner}/${repo.repo}/${repo.revision}/code-index.sqlite`;
}

export function buildRepoRequiredArtifactKeys(repo: {
  owner: string;
  repo: string;
  revision: string;
}): string[] {
  return [buildRepoManifestKey(repo), buildRepoCodeIndexKey(repo)];
}

export function buildRepoSyncArgs(repoDir: string, bucketPrefix: string): string[] {
  return ['s3', 'sync', `${repoDir}/`, bucketPrefix, '--no-progress', ...R2_SYNC_COMPARISON_ARGS];
}

export function buildManPagesBucketPrefix(bucketName: string): string {
  return `s3://${bucketName}/man-pages/`;
}

export function buildManPagesManifestKey(): string {
  return 'man-pages/linux/man-pages-6.18/manifest.json';
}

export function buildManPagesSyncArgs(manPagesDir: string, bucketPrefix: string): string[] {
  return [
    's3',
    'sync',
    `${manPagesDir}/`,
    bucketPrefix,
    '--no-progress',
    ...R2_SYNC_COMPARISON_ARGS,
  ];
}

async function readRemoteBuildSignature(
  env: DeployEnv,
  repo: { owner: string; repo: string; revision: string }
): Promise<string | null> {
  const remoteManifestPath = `s3://${env.bucketName}/${buildRepoManifestKey(repo)}`;

  const stdout = await runAwsCommandCaptureStdout(['s3', 'cp', remoteManifestPath, '-'], env);

  try {
    const manifest = JSON.parse(stdout) as RepoManifest;
    const buildSignature = manifest.buildSignature?.trim();
    return buildSignature || null;
  } catch {
    return null;
  }
}

async function shouldSkipRepoDeploy(
  env: DeployEnv,
  repoDir: string,
  repo: { id: string; owner: string; repo: string; ref: string; revision: string; guideId: string }
): Promise<boolean> {
  const localManifestPath = path.join(repoDir, 'repo-manifest.json');
  const localBuildSignature = readCurrentBuildSignatureFromManifestFile(localManifestPath, repo);
  if (!localBuildSignature) {
    return false;
  }

  const remoteArtifactsExist = await Promise.all(
    buildRepoRequiredArtifactKeys(repo).map((key) =>
      runAwsHeadObjectQuiet(env.bucketName, key, env)
    )
  );

  if (remoteArtifactsExist.some((exists) => !exists)) {
    return false;
  }

  const remoteBuildSignature = await readRemoteBuildSignature(env, repo);
  if (!remoteBuildSignature) {
    return false;
  }

  return remoteBuildSignature === localBuildSignature;
}

async function ensureRepoArtifactsUploaded(
  env: DeployEnv,
  repo: { owner: string; repo: string; revision: string }
): Promise<void> {
  const checks = await Promise.all(
    buildRepoRequiredArtifactKeys(repo).map(async (key) => ({
      key,
      exists: await runAwsHeadObjectQuiet(env.bucketName, key, env),
    }))
  );

  const missingKeys = checks.filter(({ exists }) => !exists).map(({ key }) => key);
  if (missingKeys.length > 0) {
    fail(
      `Missing uploaded corpus artifact(s) for ${repo.owner}/${repo.repo}@${repo.revision}: ${missingKeys.join(
        ', '
      )}`
    );
  }
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    fail(`Invalid ${name}: expected a positive integer, received "${rawValue}"`);
  }

  return parsed;
}

function getRetryAttempts(): number {
  return readPositiveIntEnv('R2_DEPLOY_RETRY_ATTEMPTS', DEFAULT_R2_RETRY_ATTEMPTS);
}

function getRetryBaseDelayMs(): number {
  return readPositiveIntEnv('R2_DEPLOY_RETRY_BASE_DELAY_MS', DEFAULT_R2_RETRY_BASE_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithRetries<T>(
  label: string,
  operation: () => Promise<T>,
  attempts: number,
  baseDelayMs: number
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
      console.warn(
        `   ${label} failed on attempt ${attempt}/${attempts}: ${message}. Retrying in ${(
          delayMs / 1000
        ).toFixed(delayMs >= 10_000 ? 0 : 1)}s...`
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function runWithConcurrency(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  const queue = [...tasks];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) {
        return;
      }
      await task();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
}

function countFiles(dirPath: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += countFiles(fullPath);
    } else {
      total++;
    }
  }
  return total;
}

function directorySizeBytes(dirPath: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += directorySizeBytes(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function runBucketAccessPreflight(env: DeployEnv): void {
  runPhase(
    '🔎 R2 bucket access preflight',
    () => {
      runAwsCommand(
        ['s3api', 'head-bucket', '--bucket', env.bucketName],
        env,
        `R2 bucket access preflight failed for s3://${env.bucketName}`
      );
    },
    env.bucketName
  );
}

async function syncCorpusRepos(env: DeployEnv): Promise<void> {
  let completed = 0;
  let skipped = 0;
  const retryAttempts = getRetryAttempts();
  const retryBaseDelayMs = getRetryBaseDelayMs();

  const tasks = CURATED_REPOS.map((repo) => async () => {
    const repoDir = path.join(CORPUS_REPOS_DIR, repo.owner, repo.repo, repo.revision);
    const bucketPrefix = buildRepoBucketPrefix(env.bucketName, repo);
    ensureCorpusDir(repoDir, `${repo.owner}/${repo.repo}@${repo.revision}`);

    const fileCount = countFiles(repoDir);
    const size = directorySizeBytes(repoDir);

    const manifestMatches = await runWithRetries(
      `${repo.owner}/${repo.repo}@${repo.revision} remote manifest check`,
      () => shouldSkipRepoDeploy(env, repoDir, repo),
      retryAttempts,
      retryBaseDelayMs
    );

    if (manifestMatches) {
      skipped++;
      console.log(
        `   Skipping ${repo.owner}/${repo.repo}@${repo.revision} (matching build already present in R2)`
      );
      return;
    }

    await runPhase(
      `📦 Sync ${repo.owner}/${repo.repo}`,
      async () => {
        await runWithRetries(
          `${repo.owner}/${repo.repo}@${repo.revision} sync`,
          () =>
            runAwsCommandAsync(
              buildRepoSyncArgs(repoDir, bucketPrefix),
              env,
              `Corpus repo sync failed for ${repo.owner}/${repo.repo}@${repo.revision}`
            ),
          retryAttempts,
          retryBaseDelayMs
        );

        // R2's S3-compatible sync metadata can remain unstable immediately after writes.
        // Trust the sync exit status and retry policy instead of a dry-run recheck that
        // can produce false upload/delete churn for unchanged objects.
      },
      `${fileCount} files · ${formatBytes(size)}`
    );

    await ensureRepoArtifactsUploaded(env, repo);

    completed++;
    console.log(`   Corpus repo progress: ${completed}/${CURATED_REPOS.length}`);
  });

  await runWithConcurrency(tasks, R2_SYNC_CONCURRENCY);
  console.log(`   Corpus repo sync complete: ${completed}/${CURATED_REPOS.length}`);
  if (skipped > 0) {
    console.log(`   Corpus repo skipped: ${skipped}/${CURATED_REPOS.length}`);
  }
}

async function ensureManPageArtifactsUploaded(env: DeployEnv): Promise<void> {
  const key = buildManPagesManifestKey();
  const exists = await runAwsHeadObjectQuiet(env.bucketName, key, env);
  if (!exists) {
    fail(`Missing uploaded man-page artifact: ${key}`);
  }
}

async function syncManPages(env: DeployEnv): Promise<void> {
  ensureCorpusDir(MAN_PAGES_DIR, 'man pages');

  const retryAttempts = getRetryAttempts();
  const retryBaseDelayMs = getRetryBaseDelayMs();
  const fileCount = countFiles(MAN_PAGES_DIR);
  const size = directorySizeBytes(MAN_PAGES_DIR);

  await runPhase(
    '📚 Sync Linux man pages',
    async () => {
      await runWithRetries(
        'Linux man pages sync',
        () =>
          runAwsCommandAsync(
            buildManPagesSyncArgs(MAN_PAGES_DIR, buildManPagesBucketPrefix(env.bucketName)),
            env,
            'Man-page corpus sync failed'
          ),
        retryAttempts,
        retryBaseDelayMs
      );
    },
    `${fileCount} files · ${formatBytes(size)}`
  );

  await ensureManPageArtifactsUploaded(env);
}

export async function runAwsSync(env: DeployEnv): Promise<void> {
  console.log(`\nSyncing corpus artifacts to R2 bucket ${env.bucketName}`);
  console.log(`Endpoint: https://${env.accountId}.r2.cloudflarestorage.com`);
  console.log(`Corpus root: ${CORPUS_REPOS_DIR}`);
  console.log(`Man pages root: ${MAN_PAGES_DIR}`);
  console.log(
    'Sync strategy: rely on `aws s3 sync --size-only` diffing so R2 timestamp drift does not trigger false updates.'
  );
  console.log(
    `Retry policy: ${getRetryAttempts()} attempt(s) with exponential backoff from ${getRetryBaseDelayMs()}ms.`
  );

  ensureCorpusDir(CORPUS_REPOS_DIR, 'corpus repos');

  runBucketAccessPreflight(env);

  await syncCorpusRepos(env);
  await syncManPages(env);
}

async function main(): Promise<void> {
  loadDeployEnv();
  const env = readR2Env();
  await runAwsSync(env);
  console.log('\nR2 deployment complete.');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
