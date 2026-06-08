#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import {
  CORPUS_REPOS_DIR,
  PUBLIC_STAGE_MANIFEST_PATH,
  PUBLIC_REPOS_DIR,
} from './static-asset-paths';

type StageSnapshot = {
  mode: 'dev-symlink' | 'mirror';
  repoManifests: Array<{ path: string; mtimeMs: number; size: number }>;
};

type StageMode = 'dev-symlink' | 'mirror';

function getStageMode(argv: string[]): StageMode {
  const modeArg = argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg?.split('=')[1];
  if (mode === 'dev' || mode === 'dev-symlink') {
    return 'dev-symlink';
  }
  return 'mirror';
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

function listFilesRecursive(
  rootDir: string,
  predicate?: (absolutePath: string) => boolean
): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!predicate || predicate(absolutePath)) {
        files.push(absolutePath);
      }
    }
  }

  files.sort();
  return files;
}

function buildSnapshot(mode: StageMode): StageSnapshot {
  const repoManifestPaths = listFilesRecursive(
    CORPUS_REPOS_DIR,
    (absolutePath) => path.basename(absolutePath) === 'repo-manifest.json'
  );

  return {
    mode,
    repoManifests: repoManifestPaths.map((absolutePath) => {
      const stat = fs.statSync(absolutePath);
      return {
        path: path.relative(CORPUS_REPOS_DIR, absolutePath),
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      };
    }),
  };
}

function readPreviousSnapshot(): StageSnapshot | null {
  if (!fs.existsSync(PUBLIC_STAGE_MANIFEST_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(PUBLIC_STAGE_MANIFEST_PATH, 'utf-8')) as StageSnapshot;
  } catch {
    return null;
  }
}

function hasTargetAssets(): boolean {
  return fs.existsSync(PUBLIC_REPOS_DIR);
}

function pathExistsAsSymlinkTo(targetPath: string, expectedSourcePath: string): boolean {
  try {
    const stat = fs.lstatSync(targetPath);
    if (!stat.isSymbolicLink()) {
      return false;
    }

    const symlinkTarget = fs.readlinkSync(targetPath);
    const resolvedTarget = path.resolve(path.dirname(targetPath), symlinkTarget);
    return resolvedTarget === expectedSourcePath;
  } catch {
    return false;
  }
}

function persistSnapshot(snapshot: StageSnapshot): void {
  fs.writeFileSync(PUBLIC_STAGE_MANIFEST_PATH, JSON.stringify(snapshot, null, 2));
}

function mirrorDirectory(sourceDir: string, targetDir: string): void {
  const startedAt = Date.now();
  console.log(`📦 Mirroring ${sourceDir} → ${targetDir}`);
  fs.rmSync(targetDir, { recursive: true, force: true });

  if (!fs.existsSync(sourceDir)) {
    console.log(`⚠️  Skipping missing source: ${sourceDir}`);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`✅ Mirrored ${sourceDir} → ${targetDir} (${fmtDuration(Date.now() - startedAt)})`);
}

function linkDirectory(sourceDir: string, targetDir: string): void {
  const startedAt = Date.now();
  console.log(`🔗 Linking ${targetDir} → ${sourceDir}`);

  fs.rmSync(targetDir, { recursive: true, force: true });

  if (!fs.existsSync(sourceDir)) {
    console.log(`⚠️  Skipping missing source: ${sourceDir}`);
    return;
  }

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  const relativeSource = path.relative(path.dirname(targetDir), sourceDir);
  fs.symlinkSync(relativeSource, targetDir, 'dir');
  console.log(
    `✅ Linked ${targetDir} → ${relativeSource} (${fmtDuration(Date.now() - startedAt)})`
  );
}

function main(): void {
  const startedAt = Date.now();
  const mode = getStageMode(process.argv.slice(2));
  console.log('\n[predev] Stage public static assets');
  console.log(`   Mode: ${mode}`);
  console.log(`   Source repos: ${CORPUS_REPOS_DIR}`);
  console.log(`   Target repos: ${PUBLIC_REPOS_DIR}`);

  const snapshot = buildSnapshot(mode);
  const previousSnapshot = readPreviousSnapshot();
  const snapshotChanged = JSON.stringify(snapshot) !== JSON.stringify(previousSnapshot);
  const targetsPresent = hasTargetAssets();
  const repoTargetMatchesMode =
    mode === 'dev-symlink'
      ? pathExistsAsSymlinkTo(PUBLIC_REPOS_DIR, CORPUS_REPOS_DIR)
      : fs.existsSync(PUBLIC_REPOS_DIR) &&
        !pathExistsAsSymlinkTo(PUBLIC_REPOS_DIR, CORPUS_REPOS_DIR);

  console.log(`   Snapshot: ${snapshot.repoManifests.length} repo manifests`);

  if (!targetsPresent || !repoTargetMatchesMode) {
    console.log('   Reason: public staged assets are missing');
  } else if (!previousSnapshot) {
    console.log('   Reason: no previous staging manifest found');
  } else if (snapshotChanged) {
    console.log('   Reason: corpus snapshot changed since last staging');
  } else {
    console.log('   No corpus changes detected; skipping public asset mirror');
    console.log(`done: Stage public static assets (${fmtDuration(Date.now() - startedAt)})`);
    return;
  }

  if (mode === 'dev-symlink') {
    linkDirectory(CORPUS_REPOS_DIR, PUBLIC_REPOS_DIR);
  } else {
    mirrorDirectory(CORPUS_REPOS_DIR, PUBLIC_REPOS_DIR);
  }
  persistSnapshot(snapshot);
  console.log(`done: Stage public static assets (${fmtDuration(Date.now() - startedAt)})`);
}

main();
