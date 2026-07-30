import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';

import { buildCodeIndex } from '../scripts/code-index-builder';
import {
  CODE_INDEX_FILE_NAME,
  CODE_INDEX_MAX_CONTENT_BYTES,
  CODE_INDEX_VERSION,
  findCodeIndexSymbolsByName,
  getCodeIndexGraphNeighbors,
  getCodeIndexReferencesForSymbol,
  searchCodeIndexConcepts,
  searchCodeIndexFiles,
  searchCodeIndexSymbols,
  type CodeIndexDatabaseLike,
  type CodeIndexStatementLike,
  type LoadedCodeIndex,
} from '@/lib/code-index';
import { findSymbolsInFile } from '@/lib/cross-reference';

type BetterSqliteStatementWithParams = {
  all: (...params: unknown[]) => Array<Record<string, unknown>>;
};

type BetterSqliteDatabaseWithParams = {
  prepare(sql: string): BetterSqliteStatementWithParams;
};

class BetterSqliteCodeIndexStatement implements CodeIndexStatementLike {
  private rows: Array<Record<string, unknown>> = [];
  private index = -1;

  constructor(private readonly statement: BetterSqliteStatementWithParams) {}

  bind(values: Array<string | number | null> = []): void {
    this.rows = this.statement.all(...values);
    this.index = -1;
  }

  step(): boolean {
    this.index += 1;
    return this.index < this.rows.length;
  }

  getAsObject(): Record<string, unknown> {
    return this.rows[this.index] ?? {};
  }

  free(): void {}
}

class BetterSqliteCodeIndexDatabase implements CodeIndexDatabaseLike {
  constructor(private readonly db: BetterSqliteDatabaseWithParams) {}

  prepare(sql: string): CodeIndexStatementLike {
    return new BetterSqliteCodeIndexStatement(this.db.prepare(sql));
  }
}

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root: string, relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function createSyntheticRepo(): { tempDir: string; repoDir: string } {
  const tempDir = makeTempDir('explorar-code-index-builder-');
  const repoDir = path.join(tempDir, 'example-owner', 'example-repo', 'v1.0.0');
  fs.mkdirSync(repoDir, { recursive: true });

  writeFile(repoDir, 'include/foo.h', '#pragma once\nint helper(int value);\n');
  writeFile(
    repoDir,
    'src/foo.c',
    '#include "foo.h"\n\nint helper(int value) {\n  return value + 1;\n}\n'
  );
  writeFile(
    repoDir,
    'src/main.c',
    '#include "foo.h"\n\nint main(void) {\n  return helper(41);\n}\n'
  );
  writeFile(
    repoDir,
    'lib/util.py',
    'def python_helper(value: int) -> int:\n    return value + 1\n'
  );
  writeFile(repoDir, 'docs/notes.md', '# Notes\n\nThe helper path is `src/foo.c`.\n');
  writeFile(repoDir, 'large.txt', 'x'.repeat(CODE_INDEX_MAX_CONTENT_BYTES + 128));
  writeFile(repoDir, 'search-index.json', '{"legacy":true}\n');

  return { tempDir, repoDir };
}

test.describe('code index builder', () => {
  test('indexes Linux SYSCALL_DEFINE wrappers as jumpable function definitions', () => {
    const sourcePath = path.join(process.cwd(), 'repos/torvalds/linux/v6.1/fs/readdir.c');
    test.skip(!fs.existsSync(sourcePath), 'Linux v6.1 corpus is not available locally');

    const symbols = findSymbolsInFile(fs.readFileSync(sourcePath, 'utf8'), 'fs/readdir.c');
    expect(
      symbols.find(
        (symbol) => symbol.name === 'getdents' && symbol.type === 'function' && symbol.isDefinition
      )
    ).toEqual(expect.objectContaining({ line: 271 }));
  });

  test('builds SQLite metadata, search rows, symbols, references, and graph edges', () => {
    const { tempDir, repoDir } = createSyntheticRepo();

    try {
      const stats = buildCodeIndex(
        repoDir,
        [
          {
            name: 'include',
            path: 'include',
            type: 'directory',
            children: [{ name: 'foo.h', path: 'include/foo.h', type: 'file' }],
          },
          {
            name: 'src',
            path: 'src',
            type: 'directory',
            children: [
              { name: 'foo.c', path: 'src/foo.c', type: 'file' },
              { name: 'main.c', path: 'src/main.c', type: 'file' },
            ],
          },
          {
            name: 'lib',
            path: 'lib',
            type: 'directory',
            children: [{ name: 'util.py', path: 'lib/util.py', type: 'file' }],
          },
          {
            name: 'docs',
            path: 'docs',
            type: 'directory',
            children: [{ name: 'notes.md', path: 'docs/notes.md', type: 'file' }],
          },
          { name: 'large.txt', path: 'large.txt', type: 'file' },
          { name: 'search-index.json', path: 'search-index.json', type: 'file' },
        ],
        'synthetic-build-signature'
      );

      expect(stats).toMatchObject({
        dbPath: path.join(repoDir, CODE_INDEX_FILE_NAME),
        fileCount: 6,
        symbolCount: expect.any(Number),
        edgeCount: expect.any(Number),
        truncatedFileCount: 1,
      });
      expect(stats.durationMs).toBeGreaterThanOrEqual(0);

      expect(fs.existsSync(path.join(repoDir, CODE_INDEX_FILE_NAME))).toBe(true);
      expect(fs.existsSync(path.join(repoDir, 'search-index.json'))).toBe(false);

      const db = new Database(path.join(repoDir, CODE_INDEX_FILE_NAME), {
        readonly: true,
        fileMustExist: true,
      });

      try {
        const metadata = db
          .prepare(
            'SELECT Version AS version, BuildSignature AS buildSignature, Owner AS owner, Repo AS repo, Branch AS branch, FileCount AS fileCount FROM Metadata LIMIT 1'
          )
          .get() as Record<string, unknown>;
        expect(metadata).toMatchObject({
          version: CODE_INDEX_VERSION,
          buildSignature: 'synthetic-build-signature',
          owner: 'example-owner',
          repo: 'example-repo',
          branch: 'v1.0.0',
          fileCount: 6,
        });

        expect(
          db
            .prepare('SELECT Path FROM Files ORDER BY Path')
            .all()
            .map((row) => row.Path)
        ).toEqual([
          'docs/notes.md',
          'include/foo.h',
          'large.txt',
          'lib/util.py',
          'src/foo.c',
          'src/main.c',
        ]);
        expect(
          db.prepare('SELECT ContentTruncated FROM Files WHERE Path = ?').get('large.txt')
        ).toMatchObject({ ContentTruncated: 1 });
        const largeSearchRow = db
          .prepare('SELECT length(Content) AS contentLength FROM FileSearch WHERE Path = ?')
          .get('large.txt') as Record<string, unknown>;
        expect(Number(largeSearchRow.contentLength)).toBeLessThan(CODE_INDEX_MAX_CONTENT_BYTES);
        expect(db.prepare('SELECT COUNT(*) AS count FROM Symbols').get()).toMatchObject({
          count: expect.any(Number),
        });
        expect(db.prepare('SELECT COUNT(*) AS count FROM Edges').get()).toMatchObject({
          count: expect.any(Number),
        });

        const handle: LoadedCodeIndex = {
          db: new BetterSqliteCodeIndexDatabase(db as unknown as BetterSqliteDatabaseWithParams),
          fileCount: Number(metadata.fileCount),
          buildSignature: String(metadata.buildSignature),
        };

        expect(searchCodeIndexFiles(handle, 'notes').map((entry) => entry.path)).toContain(
          'docs/notes.md'
        );

        const helperSymbols = findCodeIndexSymbolsByName(handle, 'helper', {
          definitionOnly: true,
        });
        expect(helperSymbols).toHaveLength(1);
        expect(helperSymbols[0]).toMatchObject({
          name: 'helper',
          path: 'src/foo.c',
          kind: 'function',
        });

        expect(searchCodeIndexSymbols(handle, 'helper')).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'helper',
              path: 'src/foo.c',
            }),
          ])
        );

        expect(getCodeIndexReferencesForSymbol(handle, helperSymbols[0].symbolId, true)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'src/foo.c',
              line: helperSymbols[0].startLine,
              column: helperSymbols[0].startColumn,
            }),
          ])
        );

        expect(getCodeIndexGraphNeighbors(handle, 'src/main.c')).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourcePath: 'src/main.c',
              targetPath: 'include/foo.h',
              type: 'includes',
              symbols: ['foo.h'],
            }),
            expect.objectContaining({
              sourcePath: 'src/main.c',
              targetPath: 'include/foo.h',
              type: 'calls',
              symbols: ['helper'],
            }),
          ])
        );

        expect(searchCodeIndexConcepts(handle, 'helper')).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'helper',
              kind: 'symbol',
            }),
          ])
        );
      } finally {
        db.close();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
