#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import { MAN_PAGES_DIR } from './static-asset-paths';

const MAN_PAGE_PROJECT = 'linux';
const MAN_PAGE_RELEASE = 'man-pages-6.18';
const MAN_PAGE_TARBALL_URL = `https://www.kernel.org/pub/linux/docs/man-pages/${MAN_PAGE_RELEASE}.tar.xz`;
const SOURCE_CACHE_DIR = path.join(process.cwd(), '.cache', 'man-pages', MAN_PAGE_RELEASE);
const OUTPUT_ROOT = path.join(MAN_PAGES_DIR, MAN_PAGE_PROJECT, MAN_PAGE_RELEASE);
const MANIFEST_PATH = path.join(OUTPUT_ROOT, 'manifest.json');
type ManPageManifestEntry = {
  key: string;
  name: string;
  section: string;
  title: string;
  sourcePath: string;
  htmlPath: string;
  aliases: string[];
};

type BuildOptions = {
  forceDownload: boolean;
  skipDownload: boolean;
};

function parseArgs(argv: string[]): BuildOptions {
  return {
    forceDownload: argv.includes('--force-download'),
    skipDownload: argv.includes('--skip-download'),
  };
}

function runCommand(command: string, args: string[], options?: { cwd?: string }): string {
  const result = spawnSync(command, args, {
    cwd: options?.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new Error(`Failed to launch ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with status ${result.status ?? 'unknown'}\n${result.stderr.trim()}`
    );
  }

  return result.stdout;
}

function ensureMandocAvailable(): void {
  runCommand('mandoc', ['-Thtml', '/dev/null']);
}

function downloadAndExtractSource(): void {
  fs.rmSync(SOURCE_CACHE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SOURCE_CACHE_DIR, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explorar-man-pages-'));
  const tarballPath = path.join(tmpDir, `${MAN_PAGE_RELEASE}.tar.xz`);

  try {
    runCommand('curl', ['-L', MAN_PAGE_TARBALL_URL, '-o', tarballPath]);
    runCommand('tar', ['-xJf', tarballPath, '--strip-components=1', '-C', SOURCE_CACHE_DIR]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function listManSources(sourceRoot: string): string[] {
  const manRoot = path.join(sourceRoot, 'man');
  if (!fs.existsSync(manRoot)) {
    throw new Error(`Missing man-page source directory: ${manRoot}`);
  }

  const files: string[] = [];
  const stack = [manRoot];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (/\/man\d[^/]*\/[^/]+\.\d[^/]*$/i.test(absolutePath)) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function readTitleFromHtml(html: string, fallback: string): string {
  const titleMatch =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? html.match(/<title>(.*?)<\/title>/i);
  if (!titleMatch) {
    return fallback;
  }

  return titleMatch[1]
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildManPages(options: BuildOptions): void {
  ensureMandocAvailable();

  if (
    options.forceDownload ||
    (!options.skipDownload && !fs.existsSync(path.join(SOURCE_CACHE_DIR, 'man')))
  ) {
    console.log(`Fetching ${MAN_PAGE_RELEASE} from ${MAN_PAGE_TARBALL_URL}`);
    downloadAndExtractSource();
  }

  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  const entries: ManPageManifestEntry[] = [];
  for (const sourcePath of listManSources(SOURCE_CACHE_DIR)) {
    const relSourcePath = path.relative(SOURCE_CACHE_DIR, sourcePath).replaceAll(path.sep, '/');
    const relOutputSourcePath = relSourcePath.replace(/^man\//, '');
    const sourceName = path.basename(sourcePath);
    const extMatch = sourceName.match(/\.([^.]+)$/);
    const section = extMatch?.[1] ?? '';
    const name = sourceName.slice(0, -(section.length + 1));
    const key = `${name}(${section})`;
    const relHtmlPath = `${relOutputSourcePath}.html`;
    const absoluteHtmlPath = path.join(OUTPUT_ROOT, relHtmlPath);
    fs.mkdirSync(path.dirname(absoluteHtmlPath), { recursive: true });

    const html = runCommand('mandoc', ['-Thtml', sourcePath]);
    fs.writeFileSync(absoluteHtmlPath, html);

    entries.push({
      key,
      name,
      section,
      title: readTitleFromHtml(html, key),
      sourcePath: relSourcePath,
      htmlPath: `${MAN_PAGE_PROJECT}/${MAN_PAGE_RELEASE}/${relHtmlPath}`,
      aliases: [],
    });
  }

  const manifest = {
    project: MAN_PAGE_PROJECT,
    release: MAN_PAGE_RELEASE,
    generatedAt: new Date().toISOString(),
    pages: entries,
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${entries.length} man page(s) in ${OUTPUT_ROOT}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildManPages(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
