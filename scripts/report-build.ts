#!/usr/bin/env node
/**
 * Build report: file counts, sizes, and Cloudflare Pages limit warnings.
 * Runs automatically as postbuild.
 */

import * as fs from 'fs';
import * as path from 'path';

const CLOUDFLARE_FILE_LIMIT = 20_000;
const CLOUDFLARE_FILE_WARN = 18_000;
const CLOUDFLARE_MAX_FILE_SIZE_MB = 25;

interface HostingProvider {
  name: string;
  storagePerGBMonth: number;
  egressPerGB: number;
  readsPerMillion: number;
  notes: string;
}

// Pricing as of 2025 (storage = $/GB/month, egress = $/GB, reads = $/M requests)
const PROVIDERS: HostingProvider[] = [
  {
    name: 'Cloudflare R2',
    storagePerGBMonth: 0.015,
    egressPerGB: 0,
    readsPerMillion: 0.36,
    notes: 'Free egress',
  },
  {
    name: 'AWS S3',
    storagePerGBMonth: 0.023,
    egressPerGB: 0.09,
    readsPerMillion: 0.4,
    notes: 'Use CloudFront for CDN caching',
  },
  {
    name: 'Backblaze B2',
    storagePerGBMonth: 0.006,
    egressPerGB: 0.01,
    readsPerMillion: 0.4,
    notes: 'Free via Cloudflare Bandwidth Alliance',
  },
  {
    name: 'GCS Standard',
    storagePerGBMonth: 0.02,
    egressPerGB: 0.08,
    readsPerMillion: 0.4,
    notes: 'First 1 TB/mo egress free',
  },
  {
    name: 'Azure Blob (LRS)',
    storagePerGBMonth: 0.018,
    egressPerGB: 0.087,
    readsPerMillion: 0.4,
    notes: 'First 5 GB/mo free',
  },
];

const AVG_MB_PER_VISITOR = 2.0;
const AVG_REQUESTS_PER_VISITOR = 40;

const TRAFFIC_TIERS: [string, number][] = [
  ['1k', 1_000],
  ['10k', 10_000],
  ['100k', 100_000],
];

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
  const reposDir = path.join(outDir, 'repos');

  console.log('\n' + '═'.repeat(60));
  console.log('  BUILD REPORT');
  console.log('═'.repeat(60));

  if (!fs.existsSync(outDir)) {
    console.log('  ⚠  out/ not found — build output missing');
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
      ? '✘ OVER LIMIT'
      : totalFiles > CLOUDFLARE_FILE_WARN
        ? '⚠ NEAR LIMIT'
        : '✓ OK';

  console.log(
    `\n  Files   ${totalFiles.toLocaleString()} / ${CLOUDFLARE_FILE_LIMIT.toLocaleString()}  [${bar(Math.min(limitRatio, 1))}]  ${status}`
  );
  console.log(`  Size    ${fmt(totalSize)}`);

  // Large files warning
  const oversized = allFiles.filter((f) => f.size > CLOUDFLARE_MAX_FILE_SIZE_MB * 1024 * 1024);
  if (oversized.length > 0) {
    console.log(`\n  ⚠  ${oversized.length} file(s) exceed ${CLOUDFLARE_MAX_FILE_SIZE_MB} MB:`);
    for (const f of oversized) {
      console.log(`     ${path.relative(outDir, f.path)}  (${fmt(f.size)})`);
    }
  }

  // ── Repos breakdown ────────────────────────────────────────────
  if (fs.existsSync(reposDir)) {
    console.log('\n  REPOS');
    console.log('  ' + '─'.repeat(56));

    // Walk owner/repo/branch structure
    const owners = fs.readdirSync(reposDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const owner of owners) {
      const ownerPath = path.join(reposDir, owner.name);
      const repos = fs
        .readdirSync(ownerPath, { withFileTypes: true })
        .filter((e) => e.isDirectory());
      for (const repo of repos) {
        const repoPath = path.join(ownerPath, repo.name);
        const branches = fs
          .readdirSync(repoPath, { withFileTypes: true })
          .filter((e) => e.isDirectory());
        for (const branch of branches) {
          const branchPath = path.join(repoPath, branch.name);
          const repoFiles = walk(branchPath);
          const repoSize = repoFiles.reduce((sum, f) => sum + f.size, 0);
          const label = `${owner.name}/${repo.name}@${branch.name}`;
          console.log(
            `  ${label.padEnd(44)}${repoFiles.length.toLocaleString().padStart(6)} files  ${fmt(repoSize).padStart(9)}`
          );
        }
      }
    }
  }

  // ── App files (non-repos) ──────────────────────────────────────
  const repoFiles = fs.existsSync(reposDir) ? walk(reposDir) : [];
  const appFileCount = totalFiles - repoFiles.length;
  const appSize = totalSize - repoFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(
    `\n  App files (Next.js build)  ${appFileCount.toLocaleString().padStart(6)} files  ${fmt(appSize).padStart(9)}`
  );

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
      `  ${ext.padEnd(14)}${count.toLocaleString().padStart(7)} files  ${pct.padStart(5)}%  ${fmt(size).padStart(9)}`
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

  // ── Hosting cost estimates ─────────────────────────────────────
  const totalGB = totalSize / (1024 * 1024 * 1024);

  console.log('\n  HOSTING COST ESTIMATE  (storage + egress, 2025 rates)');
  console.log('  ' + '─'.repeat(56));
  console.log(`  Build size: ${fmt(totalSize)}  (${totalGB.toFixed(3)} GB)\n`);

  const nameWidth = Math.max(...PROVIDERS.map((p) => p.name.length));
  console.log(`  ${'Provider'.padEnd(nameWidth)}   Storage/mo  Egress/GB   Notes`);
  console.log('  ' + '─'.repeat(56));
  for (const p of PROVIDERS) {
    const storageCost = totalGB * p.storagePerGBMonth;
    const egress = p.egressPerGB === 0 ? 'free    ' : `$${p.egressPerGB.toFixed(3)}/GB`;
    console.log(
      `  ${p.name.padEnd(nameWidth)}   $${storageCost.toFixed(3).padStart(8)}  ${egress.padStart(10)}   ${p.notes}`
    );
  }

  console.log(
    `\n  TRAFFIC ESTIMATE  (~${AVG_MB_PER_VISITOR} MB avg + ${AVG_REQUESTS_PER_VISITOR} req/visitor)`
  );
  console.log('  ' + '─'.repeat(56));

  const header = '  Visitors/mo  ' + PROVIDERS.map((p) => p.name.padStart(nameWidth)).join('  ');
  console.log(header);
  console.log('  ' + '─'.repeat(56));

  for (const [label, visitors] of TRAFFIC_TIERS) {
    const egressGB = (visitors * AVG_MB_PER_VISITOR) / 1024;
    const reqs = (visitors * AVG_REQUESTS_PER_VISITOR) / 1_000_000;
    const costs = PROVIDERS.map((p) => {
      const storage = totalGB * p.storagePerGBMonth;
      const egress = egressGB * p.egressPerGB;
      const reads = reqs * p.readsPerMillion;
      return `$${(storage + egress + reads).toFixed(2)}`.padStart(nameWidth);
    });
    console.log(`  ${label.padEnd(12)}  ${costs.join('  ')}`);
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}

main();
