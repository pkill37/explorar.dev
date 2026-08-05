#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import { PUBLIC_MAN_PAGES_DIR, PUBLIC_REPOS_DIR } from './static-asset-paths';

const SQLITE_WASM_SOURCE = path.join(
  process.cwd(),
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm'
);
const SQLITE_BROWSER_WASM_SOURCE = path.join(
  process.cwd(),
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm-browser.wasm'
);
const SQLITE_WASM_TARGET_DIR = path.join(process.cwd(), 'public', 'sqljs');
const SQLITE_WASM_TARGET = path.join(SQLITE_WASM_TARGET_DIR, 'sql-wasm.wasm');
const SQLITE_BROWSER_WASM_TARGET = path.join(SQLITE_WASM_TARGET_DIR, 'sql-wasm-browser.wasm');

function removeIfPresent(target: string): void {
  if (!fs.existsSync(target)) {
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}

function copyRuntimeFile(source: string, target: string): boolean {
  if (!fs.existsSync(source)) {
    console.warn(`sql.js runtime not found at ${source}; skipping copy`);
    return false;
  }

  fs.mkdirSync(SQLITE_WASM_TARGET_DIR, { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`Copied ${source} -> ${target}`);
  return true;
}

function copySqliteRuntime(): void {
  const copiedBrowserWasm = copyRuntimeFile(SQLITE_BROWSER_WASM_SOURCE, SQLITE_BROWSER_WASM_TARGET);
  const copiedDefaultWasm = copyRuntimeFile(SQLITE_WASM_SOURCE, SQLITE_WASM_TARGET);

  if (!copiedBrowserWasm && !copiedDefaultWasm) {
    console.warn('sql.js runtime not found; skipping wasm copy');
  }
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
