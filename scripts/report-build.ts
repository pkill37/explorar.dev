#!/usr/bin/env node
/**
 * Build report: file counts, sizes, and shell deployment limits.
 * Runs automatically as postbuild.
 */

import * as fs from 'fs';
import * as path from 'path';

const CLOUDFLARE_FILE_LIMIT = 20_000;
const CLOUDFLARE_FILE_WARN = 18_000;
const CLOUDFLARE_MAX_FILE_SIZE_MB = 25;

interface FileStat {
  path: string;
  size: number;
  ext: string;
}

function walk(dir: string, files: FileStat[] = []): FileStat[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      const size = fs.statSync(full).size;
      const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
      files.push({ path: full, size, ext });
    }
  }
  return files;
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function bar(ratio: number, width = 20): string {
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function main() {
  const outDir = path.join(process.cwd(), 'out');

  console.log('\n' + '═'.repeat(60));
  console.log('  SHELL BUILD REPORT');
  console.log('═'.repeat(60));

  if (!fs.existsSync(outDir)) {
    console.log('  WARNING: out/ not found - build output missing');
    console.log('═'.repeat(60) + '\n');
    return;
  }

  const allFiles = walk(outDir);
  const totalFiles = allFiles.length;
  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);

  // ── Cloudflare limits ──────────────────────────────────────────
  const limitRatio = totalFiles / CLOUDFLARE_FILE_LIMIT;
  const status =
    totalFiles > CLOUDFLARE_FILE_LIMIT
      ? 'OVER LIMIT'
      : totalFiles > CLOUDFLARE_FILE_WARN
        ? 'NEAR LIMIT'
        : 'OK';

  console.log(
    `\n  Files   ${totalFiles.toLocaleString()} / ${CLOUDFLARE_FILE_LIMIT.toLocaleString()}  [${bar(
      Math.min(limitRatio, 1)
    )}]  ${status}`
  );
  console.log(`  Size    ${fmt(totalSize)}`);

  // Large files warning
  const oversized = allFiles.filter((f) => f.size > CLOUDFLARE_MAX_FILE_SIZE_MB * 1024 * 1024);
  if (oversized.length > 0) {
    console.log(
      `\n  WARNING: ${oversized.length} file(s) exceed ${CLOUDFLARE_MAX_FILE_SIZE_MB} MB:`
    );
    for (const f of oversized) {
      console.log(`     ${path.relative(outDir, f.path)}  (${fmt(f.size)})`);
    }
  }

  // ── Top file types ─────────────────────────────────────────────
  const byExt = new Map<string, { count: number; size: number }>();
  for (const f of allFiles) {
    const cur = byExt.get(f.ext) ?? { count: 0, size: 0 };
    byExt.set(f.ext, { count: cur.count + 1, size: cur.size + f.size });
  }
  const sorted = [...byExt.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);

  console.log('\n  TOP FILE TYPES');
  console.log('  ' + '─'.repeat(56));
  for (const [ext, { count, size }] of sorted) {
    const pct = ((count / totalFiles) * 100).toFixed(1);
    console.log(
      `  ${ext.padEnd(14)}${count.toLocaleString().padStart(7)} files  ${pct.padStart(
        5
      )}%  ${fmt(size).padStart(9)}`
    );
  }

  // ── Largest files ──────────────────────────────────────────────
  const largest = [...allFiles].sort((a, b) => b.size - a.size).slice(0, 5);
  console.log('\n  LARGEST FILES');
  console.log('  ' + '─'.repeat(56));
  for (const f of largest) {
    const rel = path.relative(outDir, f.path);
    const truncated = rel.length > 46 ? '…' + rel.slice(-45) : rel;
    console.log(`  ${truncated.padEnd(46)}  ${fmt(f.size).padStart(9)}`);
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}

main();
