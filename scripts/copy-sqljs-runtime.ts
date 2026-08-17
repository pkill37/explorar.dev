#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

export function copySqliteRuntime(): void {
  const copiedBrowserWasm = copyRuntimeFile(SQLITE_BROWSER_WASM_SOURCE, SQLITE_BROWSER_WASM_TARGET);
  const copiedDefaultWasm = copyRuntimeFile(SQLITE_WASM_SOURCE, SQLITE_WASM_TARGET);

  if (!copiedBrowserWasm && !copiedDefaultWasm) {
    console.warn('sql.js runtime not found; skipping wasm copy');
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  copySqliteRuntime();
}
