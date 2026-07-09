export const CODE_INDEX_VERSION = 2;
export const CODE_INDEX_FILE_NAME = 'code-index.sqlite';
export const CODE_INDEX_SEARCH_RESULT_LIMIT = 200;
export const CODE_INDEX_PREVIEW_ENRICH_LIMIT = 20;
export const CODE_INDEX_MAX_CONTENT_BYTES = 64 * 1024;

export interface CodeIndexFileEntry {
  path: string;
  size: number;
  isDocumentation: boolean;
}

export interface CodeIndexMetadata {
  version: number;
  buildSignature: string;
  createdAt: string;
  repo: {
    owner: string;
    repo: string;
    branch: string;
  };
  fileCount: number;
}

export interface CodeIndexDatabaseLike {
  prepare(sql: string): CodeIndexStatementLike;
}

export interface CodeIndexStatementLike {
  bind(values?: Array<string | number | null>): void;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}

export interface LoadedCodeIndex {
  db: CodeIndexDatabaseLike;
  fileCount: number;
  buildSignature: string;
}

export interface SearchPreview {
  line: number;
  column: number;
  preview: string;
}

function normalizeSearchTerms(query: string): string[] {
  return (
    query
      .trim()
      .toLowerCase()
      .match(/[a-z0-9_]+/g)
      ?.filter(Boolean)
      .map((term) => term.replace(/"/g, '""')) ?? []
  );
}

export function buildFtsQuery(query: string): string | null {
  const terms = normalizeSearchTerms(query);
  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `${term}*`).join(' AND ');
}

export function searchCodeIndexFiles(
  handle: LoadedCodeIndex,
  query: string,
  limit: number = CODE_INDEX_SEARCH_RESULT_LIMIT
): CodeIndexFileEntry[] {
  const terms = normalizeSearchTerms(query);
  if (terms.length === 0) {
    return [];
  }

  const results: CodeIndexFileEntry[] = [];
  const seen = new Set<string>();

  const whereClause = terms
    .map(() => '(lower(f.Path) LIKE ? OR lower(fs.Content) LIKE ?)')
    .join(' AND ');
  const bindValues = terms.flatMap((term) => [`%${term}%`, `%${term}%`]);
  const statement = handle.db.prepare(`
    SELECT
      f.Path AS path,
      f.Size AS size,
      f.IsDocumentation AS isDocumentation
    FROM FileSearch fs
    JOIN Files f ON f.Id = fs.rowid
    WHERE ${whereClause}
    ORDER BY
      CASE WHEN ${terms.map(() => 'lower(f.Path) LIKE ?').join(' OR ')} THEN 0 ELSE 1 END,
      f.Path COLLATE NOCASE
    LIMIT ?
  `);

  try {
    statement.bind([...bindValues, ...terms.map((term) => `%${term}%`), limit]);
    while (statement.step()) {
      const row = statement.getAsObject();
      const path = String(row.path ?? '');
      if (!path || seen.has(path)) {
        continue;
      }
      seen.add(path);
      results.push({
        path,
        size: Number(row.size ?? 0),
        isDocumentation: Boolean(row.isDocumentation),
      });
    }
  } finally {
    statement.free();
  }

  return results;
}

export function buildSearchPreview(content: string, query: string): SearchPreview | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  const terms = normalizedQuery.match(/[a-z0-9_]+/g)?.filter(Boolean) ?? [];
  if (terms.length === 0) {
    return null;
  }

  const lines = content.split('\n');

  const findMatch = (predicate: (line: string) => boolean): SearchPreview | null => {
    for (let index = 0; index < lines.length; index += 1) {
      const originalLine = lines[index] ?? '';
      if (!predicate(originalLine.toLowerCase())) {
        continue;
      }

      const preview = originalLine.trim() || '(empty line)';
      const firstTerm = terms.find((term) => originalLine.toLowerCase().includes(term));
      const column =
        firstTerm !== undefined ? originalLine.toLowerCase().indexOf(firstTerm) + 1 : 1;

      return {
        line: index + 1,
        column,
        preview,
      };
    }

    return null;
  };

  const exactMatch = findMatch((line) => terms.every((term) => line.includes(term)));
  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = findMatch((line) => terms.some((term) => line.includes(term)));
  if (partialMatch) {
    return partialMatch;
  }

  const fallbackPreview = lines[0]?.trim() || '(empty file)';
  return {
    line: 1,
    column: 1,
    preview: fallbackPreview,
  };
}
