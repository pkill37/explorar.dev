#!/usr/bin/env node

import fs from 'fs';

import { PUBLIC_REPOS_DIR } from './static-asset-paths';

function removeIfPresent(target: string): void {
  if (!fs.existsSync(target)) {
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}

function main(): void {
  removeIfPresent(PUBLIC_REPOS_DIR);
  console.log('Public repo corpus cleared for shell-only Next build. Avatars retained.');
}

main();
