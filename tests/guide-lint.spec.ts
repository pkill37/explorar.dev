import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import matter from 'gray-matter';
import { fetchRepositoryFile } from '../src/lib/github-api';
import {
  checkGuide,
  parseSections,
  resolveRepoPath,
  stripFencedBlocks,
} from '../scripts/check-guide-refs';
import { CORPUS_REPOS_DIR } from '../scripts/static-asset-paths';
import { resolveCorpusPathFromKnownFiles } from '../src/lib/repo-static';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function looksLikeRepoPath(ref: string): boolean {
  if (!ref || ref.includes('://') || ref.startsWith('#') || ref.startsWith('/')) return false;
  return ref.includes('/') || /\.[A-Za-z0-9]+$/.test(ref) || ref.endsWith('/');
}

function extractInlineRefs(prose: string): string[] {
  const refs = new Set<string>();
  const MD_LINK_RE = /\[(?:[^\]]*)\]\(([\w./\-@:]+)\)/g;
  const BACKTICK_RE = /`([^`\n]+)`/g;

  for (const line of stripFencedBlocks(prose).split('\n')) {
    for (const match of line.matchAll(MD_LINK_RE)) {
      const ref = match[1];
      if (looksLikeRepoPath(ref)) {
        refs.add(ref);
      }
    }

    for (const match of line.matchAll(BACKTICK_RE)) {
      const ref = match[1].trim();
      if (looksLikeRepoPath(ref)) {
        refs.add(ref);
      }
    }
  }

  return Array.from(refs);
}

function normalizeInlineRef(ref: string): string {
  return ref.replace(/[:#].*$/, '');
}

test.describe('guide reference linting', () => {
  test('resolves bare file names against the downloaded corpus', () => {
    const repoRoot = makeTempDir('explorar-guide-lint-');
    try {
      const filePath = path.join(repoRoot, 'arch/arm64/kernel/entry.S');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'entry:\n\tret\n');

      expect(resolveRepoPath(repoRoot, 'entry.S')).toBe('arch/arm64/kernel/entry.S');
      expect(resolveCorpusPathFromKnownFiles('entry.S', ['arch/arm64/kernel/entry.S'])).toBe(
        'arch/arm64/kernel/entry.S'
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('prefers arm64 when a bare file name is ambiguous', () => {
    expect(
      resolveCorpusPathFromKnownFiles('entry.S', [
        'arch/x86/entry/entry.S',
        'arch/arm64/kernel/entry.S',
      ])
    ).toBe('arch/arm64/kernel/entry.S');
  });

  test('fetchRepositoryFile resolves a bare file name through the corpus manifest', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.includes('repo-manifest.json') || url.includes('.repo-manifest.json')) {
        return new Response(
          JSON.stringify({
            tree: [
              {
                name: 'arch',
                type: 'd',
                children: [
                  {
                    name: 'arm64',
                    type: 'd',
                    children: [
                      {
                        name: 'kernel',
                        type: 'd',
                        children: [{ name: 'entry.S', type: 'f' }],
                      },
                    ],
                  },
                  {
                    name: 'x86',
                    type: 'd',
                    children: [
                      {
                        name: 'entry',
                        type: 'd',
                        children: [{ name: 'entry.S', type: 'f' }],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      }

      if (url.endsWith('/arch/arm64/kernel/entry.S')) {
        return new Response('entry:\n\tret\n', { status: 200 });
      }

      if (url.endsWith('/entry.S')) {
        return new Response('missing', { status: 404 });
      }

      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await fetchRepositoryFile('torvalds', 'linux', 'v6.1', 'entry.S');
      expect(result.content).toContain('entry:');
      expect(calls.some((url) => url.endsWith('/entry.S'))).toBeTruthy();
      expect(calls.some((url) => url.endsWith('/arch/arm64/kernel/entry.S'))).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetchRepositoryFile does not fetch the manifest for an exact curated path', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/arch/arm64/kernel/entry.S')) {
        return new Response('entry:\n\tret\n', { status: 200 });
      }

      if (url.includes('repo-manifest.json') || url.includes('.repo-manifest.json')) {
        throw new Error(`Unexpected manifest fetch: ${url}`);
      }

      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await fetchRepositoryFile(
        'torvalds',
        'linux',
        'v6.1-exact-path',
        'arch/arm64/kernel/entry.S'
      );

      expect(result.content).toContain('entry:');
      expect(calls.some((url) => url.includes('repo-manifest.json'))).toBeFalsy();
      expect(calls.some((url) => url.includes('.repo-manifest.json'))).toBeFalsy();
      expect(calls.some((url) => url.endsWith('/arch/arm64/kernel/entry.S'))).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetchRepositoryFile does not probe directory-like paths', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response('unexpected network call', { status: 500 });
    }) as typeof fetch;

    try {
      await expect(
        fetchRepositoryFile('apple-oss-distributions', 'xnu', 'xnu-12377.1.9', 'bsd/')
      ).rejects.toMatchObject({
        status: 404,
      });
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('the Linux guide uses canonical source paths in prose', () => {
    const guidePath = path.join(process.cwd(), 'docs/torvalds_linux.md');
    const guide = fs.readFileSync(guidePath, 'utf8');
    const lines = guide.split('\n');
    const bareRefs = ['fork.c', 'signal.c', 'fair.c', 'core.c', 'rt.c', 'entry.S'];
    for (const ref of bareRefs) {
      const matchingLines = lines.filter((line) => line.includes(ref));
      expect(matchingLines.length).toBeGreaterThan(0);
      expect(matchingLines.every((line) => line.includes('/'))).toBeTruthy();
    }
    expect(guide).toContain('kernel/fork.c');
    expect(guide).toContain('kernel/signal.c');
    expect(guide).toContain('kernel/sched/fair.c');
    expect(guide).toContain('arch/arm64/kernel/entry.S');
  });

  test('flags bare file references in guide prose when the corpus does not contain them', () => {
    const repoRoot = makeTempDir('explorar-guide-lint-');
    try {
      const existingFile = path.join(repoRoot, 'arch/arm64/kernel/entry.S');
      fs.mkdirSync(path.dirname(existingFile), { recursive: true });
      fs.writeFileSync(existingFile, 'entry:\n\tret\n');

      const guide = `---
id: linux-kernel-guide
title: Kernel Entry
fileRecommendations:
  source:
    - path: arch/arm64/kernel/entry.S
      description: Real corpus path for syscall entry.
---

The full path exists, but the bare reference \`missing_entry.S\` should still be linted.
The markdown link [missing_entry.S](./missing_entry.S) should also be checked.
---`;

      const sections = parseSections(guide);
      const result = checkGuide(repoRoot, sections);

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('missing_entry.S'),
          expect.stringContaining('(inline code)'),
          expect.stringContaining('(markdown link)'),
        ])
      );
      expect(
        result.errors.some((error) => error.includes('arch/arm64/kernel/entry.S'))
      ).toBeFalsy();
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('all inline prose file references resolve to corpus files', () => {
    const docsDir = path.join(process.cwd(), 'docs');
    const docFiles = fs
      .readdirSync(docsDir)
      .filter((file) => file.endsWith('.md') && file !== 'common.md')
      .sort();
    let checkedDocs = 0;

    for (const fileName of docFiles) {
      const docPath = path.join(docsDir, fileName);
      const raw = fs.readFileSync(docPath, 'utf8');
      const { data } = matter(raw);
      const owner = String(data.owner ?? '');
      const repo = String(data.repo ?? '');
      const revision = String(data.revision ?? '');
      const repoRoot = path.join(CORPUS_REPOS_DIR, owner, repo, revision);

      if (!fs.existsSync(repoRoot)) {
        continue;
      }
      checkedDocs++;

      const sections = parseSections(raw);
      const inlineRefs = sections.flatMap((section) => extractInlineRefs(section.prose));

      for (const ref of inlineRefs) {
        const normalizedRef = normalizeInlineRef(ref);
        expect(
          resolveRepoPath(repoRoot, normalizedRef),
          `unresolved inline prose ref in ${fileName}: ${ref}`
        ).not.toBeNull();
      }
    }

    expect(
      checkedDocs,
      'expected at least one guide with a downloaded corpus root'
    ).toBeGreaterThan(0);
  });
});
