import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';

import { CURATED_REPOS } from '@/lib/curated-repos';
import { CORPUS_REPOS_DIR } from '../scripts/static-asset-paths';

type CodeIndexMetadataRow = {
  version: number;
  buildSignature: string;
  createdAt: string;
  owner: string;
  repo: string;
  branch: string;
  fileCount: number;
};

function getRepoDir(repo: (typeof CURATED_REPOS)[number]): string {
  return path.join(CORPUS_REPOS_DIR, repo.owner, repo.repo, repo.revision);
}

function readCodeIndexMetadata(indexPath: string): CodeIndexMetadataRow {
  const db = new Database(indexPath, { readonly: true, fileMustExist: true });

  try {
    const row = db
      .prepare(
        'SELECT Version as version, BuildSignature as buildSignature, CreatedAt as createdAt, Owner as owner, Repo as repo, Branch as branch, FileCount as fileCount FROM Metadata LIMIT 1'
      )
      .get() as CodeIndexMetadataRow | undefined;

    if (!row) {
      throw new Error('Missing Metadata row');
    }

    return row;
  } finally {
    db.close();
  }
}

test.describe('Corpus SQLite index', () => {
  test('exists for every curated repository', () => {
    for (const repo of CURATED_REPOS) {
      const repoDir = getRepoDir(repo);
      const manifestPath = path.join(repoDir, 'repo-manifest.json');
      const codeIndexPath = path.join(repoDir, 'code-index.sqlite');

      expect(
        fs.existsSync(repoDir),
        `missing repo dir for ${repo.owner}/${repo.repo}`
      ).toBeTruthy();
      expect(
        fs.existsSync(manifestPath),
        `missing manifest for ${repo.owner}/${repo.repo}`
      ).toBeTruthy();
      expect(
        fs.existsSync(codeIndexPath),
        `missing code index for ${repo.owner}/${repo.repo}`
      ).toBeTruthy();
    }
  });

  test('metadata matches the curated repo revision', () => {
    for (const repo of CURATED_REPOS) {
      const codeIndexPath = path.join(getRepoDir(repo), 'code-index.sqlite');
      const metadata = readCodeIndexMetadata(codeIndexPath);

      expect(metadata.version, `${repo.owner}/${repo.repo}`).toBe(2);
      expect(metadata.owner, `${repo.owner}/${repo.repo}`).toBe(repo.owner);
      expect(metadata.repo, `${repo.owner}/${repo.repo}`).toBe(repo.repo);
      expect(metadata.branch, `${repo.owner}/${repo.repo}`).toBe(repo.revision);
      expect(metadata.fileCount, `${repo.owner}/${repo.repo}`).toBeGreaterThan(0);
      expect(metadata.buildSignature, `${repo.owner}/${repo.repo}`).toContain(repo.revision);
      expect(metadata.createdAt, `${repo.owner}/${repo.repo}`).toContain('T');
    }
  });
});
