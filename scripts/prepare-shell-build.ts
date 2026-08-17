#!/usr/bin/env node

import fs from 'fs';

import { copySqliteRuntime } from './copy-sqljs-runtime';
import { PUBLIC_MAN_PAGES_DIR, PUBLIC_REPOS_DIR } from './static-asset-paths';

function removeIfPresent(target: string): void {
  if (!fs.existsSync(target)) {
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}

function main(): void {
  removeIfPresent(PUBLIC_REPOS_DIR);
  removeIfPresent(PUBLIC_MAN_PAGES_DIR);
  copySqliteRuntime();
  console.log(
    'Public repo and man-page corpora cleared for shell-only Next build. Avatars retained.'
  );
}

main();
