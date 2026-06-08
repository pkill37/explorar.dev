#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { inspectCorpusState } from './download-repos';

type Step = {
  name: string;
  command: string;
  args: string[];
};

function fail(message: string): never {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
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

function runStep(index: number, total: number, step: Step): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n[${index}/${total}] ${step.name}`);
  console.log(`    $ ${step.command} ${step.args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      reject(new Error(`${step.name} failed to launch: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${step.name} exited with status ${code ?? 'unknown'}`));
        return;
      }

      console.log(`done: ${step.name} (${fmtDuration(Date.now() - startedAt)})`);
      resolve();
    });
  });
}

async function runConcurrentGroup(
  index: number,
  total: number,
  label: string,
  steps: Step[]
): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n[${index}/${total}] ${label}`);

  const results = await Promise.allSettled(steps.map((step) => runStep(index, total, step)));

  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason);

  if (failures.length > 0) {
    const message = failures
      .map((failure) => (failure instanceof Error ? failure.message : String(failure)))
      .join('\n');
    fail(message);
  }

  console.log(`done: ${label} (${fmtDuration(Date.now() - startedAt)})`);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log('\nBuild pipeline starting (5 phases)\n');

  const corpusState = await inspectCorpusState({
    only: [],
    skip: [],
    depth: 1,
    list: false,
    avatarsOnly: false,
  });

  if (corpusState.missingAvatars.length === 0 && corpusState.staleRepos.length === 0) {
    console.log('\n[1/5] 📦 Download curated corpus');
    console.log(
      `done: 📦 Download curated corpus (skipped; ${corpusState.totalRepos} repos and ${corpusState.totalAvatars} avatars already cached)`
    );
  } else {
    console.log('\nCorpus refresh required before build:');
    if (corpusState.staleRepos.length > 0) {
      console.log(`    Refreshing ${corpusState.staleRepos.length} repo target(s)`);
    }
    if (corpusState.missingAvatars.length > 0) {
      console.log(`    Fetching ${corpusState.missingAvatars.length} missing avatar(s)`);
    }
    await runStep(1, 5, {
      name: '📦 Download curated corpus',
      command: 'tsx',
      args:
        corpusState.staleRepos.length === 0 && corpusState.missingAvatars.length > 0
          ? ['scripts/download-repos.ts', '--avatars-only']
          : ['scripts/download-repos.ts', '--depth=1'],
    });
  }

  await runConcurrentGroup(2, 5, 'Guide validation', [
    {
      name: '🧭 Validate guide frontmatter',
      command: 'tsx',
      args: ['scripts/validate-guides.ts'],
    },
    {
      name: '🔎 Check guide references against corpus',
      command: 'tsx',
      args: ['scripts/check-guide-refs.ts'],
    },
  ]);

  await runStep(3, 5, {
    name: '🧹 Prepare shell-only public assets',
    command: 'tsx',
    args: ['scripts/prepare-shell-build.ts'],
  });

  await runStep(4, 5, {
    name: '🏗️ Run Next.js production build',
    command: 'next',
    args: ['build'],
  });

  await runStep(5, 5, {
    name: '📊 Generate build report',
    command: 'tsx',
    args: ['scripts/report-build.ts'],
  });

  console.log(`\nBuild pipeline complete in ${fmtDuration(Date.now() - startedAt)}.`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
