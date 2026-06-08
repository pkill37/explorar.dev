#!/usr/bin/env node
/**
 * Deploy the trimmed static shell to Cloudflare Pages.
 *
 * This mirrors the GitHub Actions Pages step:
 * - copy `out/` to a temp directory
 * - remove R2-hosted repo payloads (`repos/`)
 * - deploy the remaining site shell to Cloudflare Pages
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { loadDeployEnv } from './deploy-env';
import { ensureOutDir, fail } from './deploy-r2';

type PagesEnv = {
  accountId: string;
  apiToken: string;
  projectName: string;
};

function readPagesEnv(): PagesEnv {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const projectName = process.env.CLOUDFLARE_PAGES_PROJECT?.trim() || 'explorar-dev';

  if (!accountId) fail('Missing CLOUDFLARE_ACCOUNT_ID');
  if (!apiToken) fail('Missing CLOUDFLARE_API_TOKEN');

  return { accountId, apiToken, projectName };
}

function createPagesBundle(): string {
  const sourceDir = path.join(process.cwd(), 'out');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explorar-pages-'));
  const bundleDir = path.join(tempDir, 'out');

  fs.cpSync(sourceDir, bundleDir, { recursive: true });
  fs.rmSync(path.join(bundleDir, 'repos'), { recursive: true, force: true });

  return bundleDir;
}

function resolveWranglerCommand(): { command: string; args: string[] } {
  const localWrangler = path.join(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(localWrangler)) {
    return { command: localWrangler, args: [] };
  }

  return { command: 'npx', args: ['--yes', 'wrangler@4'] };
}

function deployPages(bundleDir: string, env: PagesEnv): void {
  const wrangler = resolveWranglerCommand();
  const args = [
    ...wrangler.args,
    'pages',
    'deploy',
    bundleDir,
    '--project-name',
    env.projectName,
    '--branch',
    'main',
    '--commit-dirty=true',
  ];

  console.log(`\n🚀 Deploying trimmed site shell to Cloudflare Pages project ${env.projectName}`);
  console.log(`   Directory: ${bundleDir}`);

  const result = spawnSync(wrangler.command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: env.accountId,
      CLOUDFLARE_API_TOKEN: env.apiToken,
    },
  });

  if (result.error) {
    fail(`Failed to launch Wrangler: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`Wrangler Pages deploy exited with status ${result.status ?? 'unknown'}`);
  }
}

function main(): void {
  ensureOutDir();
  loadDeployEnv();
  const env = readPagesEnv();
  const bundleDir = createPagesBundle();
  deployPages(bundleDir, env);
  console.log('\n✅ Cloudflare Pages deployment complete.');
}

main();
