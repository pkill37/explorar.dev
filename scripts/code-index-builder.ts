import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import { findSymbolsInFile, type SymbolReference } from '../src/lib/cross-reference';
import { extractEntities, type CodeEntity } from '../src/lib/entity-extraction';
import {
  CODE_INDEX_FILE_NAME,
  CODE_INDEX_MAX_CONTENT_BYTES,
  CODE_INDEX_VERSION,
} from '../src/lib/code-index';

type FileTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
};

type IndexedMember = {
  name: string;
  type: string;
  line: number;
  ordinal: number;
};

type IndexedParameter = {
  name: string;
  type: string;
  ordinal: number;
};

type IndexedSymbol = {
  name: string;
  kind: string;
  language: string;
  signature: string | null;
  doc: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  isDefinition: number;
  isDeclaration: number;
  content: string;
  members: IndexedMember[];
  parameters: IndexedParameter[];
  references: Array<{ line: number; column: number }>;
};

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Metadata (
  Version INTEGER NOT NULL,
  BuildSignature TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  Owner TEXT NOT NULL,
  Repo TEXT NOT NULL,
  Branch TEXT NOT NULL,
  FileCount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Files (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Path TEXT NOT NULL UNIQUE,
  Size INTEGER NOT NULL,
  IsDocumentation INTEGER NOT NULL,
  Language TEXT NOT NULL,
  Extension TEXT NOT NULL,
  ContentTruncated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Symbols (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  FileId INTEGER NOT NULL,
  Name TEXT NOT NULL,
  Kind TEXT NOT NULL,
  Language TEXT NOT NULL,
  Signature TEXT,
  Doc TEXT,
  StartLine INTEGER NOT NULL,
  StartColumn INTEGER NOT NULL,
  EndLine INTEGER NOT NULL,
  EndColumn INTEGER NOT NULL,
  IsDefinition INTEGER NOT NULL,
  IsDeclaration INTEGER NOT NULL,
  FOREIGN KEY (FileId) REFERENCES Files(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Members (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  SymbolId INTEGER NOT NULL,
  Name TEXT NOT NULL,
  Type TEXT NOT NULL,
  Line INTEGER NOT NULL,
  Ordinal INTEGER NOT NULL,
  FOREIGN KEY (SymbolId) REFERENCES Symbols(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Parameters (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  SymbolId INTEGER NOT NULL,
  Name TEXT NOT NULL,
  Type TEXT NOT NULL,
  Ordinal INTEGER NOT NULL,
  FOREIGN KEY (SymbolId) REFERENCES Symbols(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "References" (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  SymbolId INTEGER NOT NULL,
  FileId INTEGER NOT NULL,
  Line INTEGER NOT NULL,
  Column INTEGER NOT NULL,
  FOREIGN KEY (SymbolId) REFERENCES Symbols(Id) ON DELETE CASCADE,
  FOREIGN KEY (FileId) REFERENCES Files(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS FileSearch (
  rowid INTEGER PRIMARY KEY,
  Path TEXT NOT NULL,
  Content TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_FileSearch_Path ON FileSearch(Path);

CREATE TABLE IF NOT EXISTS SymbolSearch (
  rowid INTEGER PRIMARY KEY,
  Name TEXT NOT NULL,
  Signature TEXT,
  Doc TEXT,
  Path TEXT NOT NULL,
  Content TEXT NOT NULL,
  Kind TEXT NOT NULL,
  Language TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_SymbolSearch_Name ON SymbolSearch(Name);
CREATE INDEX IF NOT EXISTS idx_SymbolSearch_Path ON SymbolSearch(Path);

CREATE VIEW IF NOT EXISTS Functions AS
SELECT
  s.Id AS SymbolId,
  s.FileId AS FileId,
  f.Path AS Path,
  s.Name AS Name,
  s.Signature AS Signature,
  s.Doc AS Doc,
  s.StartLine AS StartLine,
  s.EndLine AS EndLine,
  s.StartColumn AS StartColumn,
  s.EndColumn AS EndColumn,
  s.Language AS Language,
  s.Kind AS Kind,
  s.IsDefinition AS IsDefinition,
  s.IsDeclaration AS IsDeclaration
FROM Symbols s
JOIN Files f ON f.Id = s.FileId
WHERE s.Kind = 'function';

CREATE VIEW IF NOT EXISTS Structs AS
SELECT
  s.Id AS SymbolId,
  s.FileId AS FileId,
  f.Path AS Path,
  s.Name AS Name,
  s.Signature AS Signature,
  s.Doc AS Doc,
  s.StartLine AS StartLine,
  s.EndLine AS EndLine,
  s.StartColumn AS StartColumn,
  s.EndColumn AS EndColumn,
  s.Language AS Language,
  s.Kind AS Kind,
  s.IsDefinition AS IsDefinition,
  s.IsDeclaration AS IsDeclaration
FROM Symbols s
JOIN Files f ON f.Id = s.FileId
WHERE s.Kind = 'struct';

CREATE VIEW IF NOT EXISTS Classes AS
SELECT
  s.Id AS SymbolId,
  s.FileId AS FileId,
  f.Path AS Path,
  s.Name AS Name,
  s.Signature AS Signature,
  s.Doc AS Doc,
  s.StartLine AS StartLine,
  s.EndLine AS EndLine,
  s.StartColumn AS StartColumn,
  s.EndColumn AS EndColumn,
  s.Language AS Language,
  s.Kind AS Kind,
  s.IsDefinition AS IsDefinition,
  s.IsDeclaration AS IsDeclaration
FROM Symbols s
JOIN Files f ON f.Id = s.FileId
WHERE s.Kind = 'class';

CREATE VIEW IF NOT EXISTS Interfaces AS
SELECT
  s.Id AS SymbolId,
  s.FileId AS FileId,
  f.Path AS Path,
  s.Name AS Name,
  s.Signature AS Signature,
  s.Doc AS Doc,
  s.StartLine AS StartLine,
  s.EndLine AS EndLine,
  s.StartColumn AS StartColumn,
  s.EndColumn AS EndColumn,
  s.Language AS Language,
  s.Kind AS Kind,
  s.IsDefinition AS IsDefinition,
  s.IsDeclaration AS IsDeclaration
FROM Symbols s
JOIN Files f ON f.Id = s.FileId
WHERE s.Kind = 'interface';

CREATE VIEW IF NOT EXISTS Types AS
SELECT
  s.Id AS SymbolId,
  s.FileId AS FileId,
  f.Path AS Path,
  s.Name AS Name,
  s.Signature AS Signature,
  s.Doc AS Doc,
  s.StartLine AS StartLine,
  s.EndLine AS EndLine,
  s.StartColumn AS StartColumn,
  s.EndColumn AS EndColumn,
  s.Language AS Language,
  s.Kind AS Kind,
  s.IsDefinition AS IsDefinition,
  s.IsDeclaration AS IsDeclaration
FROM Symbols s
JOIN Files f ON f.Id = s.FileId
WHERE s.Kind IN ('type', 'typedef', 'enum');

CREATE VIEW IF NOT EXISTS Macros AS
SELECT
  s.Id AS SymbolId,
  s.FileId AS FileId,
  f.Path AS Path,
  s.Name AS Name,
  s.Signature AS Signature,
  s.Doc AS Doc,
  s.StartLine AS StartLine,
  s.EndLine AS EndLine,
  s.StartColumn AS StartColumn,
  s.EndColumn AS EndColumn,
  s.Language AS Language,
  s.Kind AS Kind,
  s.IsDefinition AS IsDefinition,
  s.IsDeclaration AS IsDeclaration
FROM Symbols s
JOIN Files f ON f.Id = s.FileId
WHERE s.Kind = 'macro';
`;

function readFileContent(absolutePath: string): { content: string; truncated: boolean } {
  const fd = fs.openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(CODE_INDEX_MAX_CONTENT_BYTES);
    const bytesRead = fs.readSync(fd, buffer, 0, CODE_INDEX_MAX_CONTENT_BYTES, 0);
    const truncated = fs.statSync(absolutePath).size > CODE_INDEX_MAX_CONTENT_BYTES;
    return {
      content: buffer.subarray(0, bytesRead).toString('utf8'),
      truncated,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().replace(/^\./, '');
}

function detectLanguage(filePath: string): string {
  const ext = getFileExtension(filePath);
  switch (ext) {
    case 'py':
      return 'python';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'c':
    case 'cc':
    case 'cpp':
    case 'cxx':
    case 'h':
    case 'hh':
    case 'hpp':
    case 'hxx':
    case 'inc':
    case 'inl':
      return 'c-family';
    case 'md':
    case 'markdown':
    case 'rst':
    case 'txt':
    case 'adoc':
    case 'asciidoc':
      return 'documentation';
    default:
      return 'text';
  }
}

function extractParameters(signature: string | null): IndexedParameter[] {
  if (!signature) {
    return [];
  }

  const openParen = signature.indexOf('(');
  const closeParen = signature.lastIndexOf(')');
  if (openParen < 0 || closeParen <= openParen + 1) {
    return [];
  }

  const body = signature.slice(openParen + 1, closeParen).trim();
  if (!body || body === 'void') {
    return [];
  }

  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of body) {
    if (char === '(' || char === '<' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === '>' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1);
    }

    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.flatMap((part, ordinal) => {
    const trimmed = part.replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed === '...') {
      return [];
    }

    const match = trimmed.match(/^(.*?)([A-Za-z_]\w*)$/);
    if (!match) {
      return [{ name: `arg${ordinal + 1}`, type: trimmed, ordinal }];
    }

    const type = match[1].trim().replace(/\s+\*$/, '*');
    const name = match[2];
    return [{ name, type: type || '', ordinal }];
  });
}

function symbolKindToViewKind(symbol: SymbolReference): string {
  switch (symbol.type) {
    case 'typedef':
      return 'type';
    default:
      return symbol.type;
  }
}

function symbolToIndexedSymbol(symbol: SymbolReference): IndexedSymbol {
  const kind = symbolKindToViewKind(symbol);
  const language = 'c-family';
  const signature = symbol.signature?.trim() || null;
  const doc = symbol.documentation?.trim() || null;
  return {
    name: symbol.name,
    kind,
    language,
    signature,
    doc,
    startLine: symbol.line,
    startColumn: symbol.column,
    endLine: symbol.line,
    endColumn: symbol.column + symbol.name.length,
    isDefinition: symbol.isDefinition ? 1 : 0,
    isDeclaration: symbol.isDeclaration ? 1 : 0,
    content: [
      symbol.signature,
      symbol.documentation,
      symbol.members?.map((m) => `${m.name}: ${m.type}`).join('\n'),
    ]
      .filter(Boolean)
      .join('\n')
      .trim(),
    members:
      symbol.members?.map((member, index) => ({
        name: member.name,
        type: member.type,
        line: member.line,
        ordinal: index,
      })) ?? [],
    parameters: extractParameters(signature),
    references: symbol.references.map((reference) => ({
      line: reference.line,
      column: reference.column,
    })),
  };
}

function entityToIndexedSymbol(entity: CodeEntity & { line: number }): IndexedSymbol {
  const signature =
    entity.fields.length > 0
      ? `${entity.kind} ${entity.name} { ${entity.fields
          .map((field) => `${field.name}: ${field.type}`)
          .join('; ')} }`
      : `${entity.kind} ${entity.name}`;

  return {
    name: entity.name,
    kind: entity.kind === 'enum' ? 'type' : entity.kind,
    language: entity.language,
    signature,
    doc: null,
    startLine: entity.line,
    startColumn: 1,
    endLine: entity.line,
    endColumn: Math.max(1, entity.name.length),
    isDefinition: 1,
    isDeclaration: 0,
    content: signature,
    members: entity.fields.map((field, index) => ({
      name: field.name,
      type: field.type,
      line: entity.line,
      ordinal: index,
    })),
    parameters: [],
    references: [],
  };
}

function collectFileEntries(nodes: FileTreeNode[], parentPath: string = ''): string[] {
  const entries: string[] = [];

  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.type === 'file') {
      if (
        node.name !== 'repo-manifest.json' &&
        node.name !== CODE_INDEX_FILE_NAME &&
        node.name !== 'search-index.json'
      ) {
        entries.push(currentPath);
      }
      continue;
    }

    if (node.children?.length) {
      entries.push(...collectFileEntries(node.children, currentPath));
    }
  }

  return entries;
}

function flattenSymbols(content: string, filePath: string): IndexedSymbol[] {
  const indexed: IndexedSymbol[] = [];
  const ext = getFileExtension(filePath);

  if (['c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'inc', 'inl'].includes(ext)) {
    for (const symbol of findSymbolsInFile(content, filePath)) {
      if (
        symbol.isDefinition &&
        (symbol.type === 'function' ||
          symbol.type === 'struct' ||
          symbol.type === 'class' ||
          symbol.type === 'typedef' ||
          symbol.type === 'macro')
      ) {
        indexed.push(symbolToIndexedSymbol(symbol));
      }
    }
    return indexed;
  }

  const extractedEntities = extractEntities(filePath, content);
  for (const entity of extractedEntities) {
    indexed.push(entityToIndexedSymbol(entity));
  }
  return indexed;
}

export function buildCodeIndex(
  repoDir: string,
  tree: FileTreeNode[],
  buildSignature: string
): void {
  const dbPath = path.join(repoDir, CODE_INDEX_FILE_NAME);
  const legacySearchIndexPath = path.join(repoDir, 'search-index.json');
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }
  if (fs.existsSync(legacySearchIndexPath)) {
    fs.rmSync(legacySearchIndexPath, { force: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.exec(SCHEMA_SQL);

  const insertMetadata = db.prepare(
    'INSERT INTO Metadata(Version, BuildSignature, CreatedAt, Owner, Repo, Branch, FileCount) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertFile = db.prepare(
    'INSERT INTO Files(Path, Size, IsDocumentation, Language, Extension, ContentTruncated) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertSymbol = db.prepare(
    'INSERT INTO Symbols(FileId, Name, Kind, Language, Signature, Doc, StartLine, StartColumn, EndLine, EndColumn, IsDefinition, IsDeclaration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertFileSearch = db.prepare(
    'INSERT INTO FileSearch(rowid, Path, Content) VALUES (?, ?, ?)'
  );
  const insertSymbolSearch = db.prepare(
    'INSERT INTO SymbolSearch(rowid, Name, Signature, Doc, Path, Content, Kind, Language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertMember = db.prepare(
    'INSERT INTO Members(SymbolId, Name, Type, Line, Ordinal) VALUES (?, ?, ?, ?, ?)'
  );
  const insertParameter = db.prepare(
    'INSERT INTO Parameters(SymbolId, Name, Type, Ordinal) VALUES (?, ?, ?, ?)'
  );
  const insertReference = db.prepare(
    'INSERT INTO "References"(SymbolId, FileId, Line, Column) VALUES (?, ?, ?, ?)'
  );

  const filePaths = collectFileEntries(tree).sort((a, b) => a.localeCompare(b));
  let processed = 0;
  let truncatedFiles = 0;
  let totalSymbols = 0;

  const owner = path.basename(path.dirname(path.dirname(repoDir)));
  const repo = path.basename(path.dirname(repoDir));
  const branch = path.basename(repoDir);

  insertMetadata.run(
    CODE_INDEX_VERSION,
    buildSignature,
    new Date().toISOString(),
    owner,
    repo,
    branch,
    filePaths.length
  );

  const batchSize = 100;
  const batches: Array<{
    filePath: string;
    size: number;
    isDocumentation: boolean;
    language: string;
    extension: string;
    content: string;
    contentTruncated: boolean;
    symbols: IndexedSymbol[];
  }> = [];

  const flushBatch = db.transaction(
    (
      records: Array<{
        filePath: string;
        size: number;
        isDocumentation: boolean;
        language: string;
        extension: string;
        content: string;
        contentTruncated: boolean;
        symbols: IndexedSymbol[];
      }>
    ) => {
      for (const record of records) {
        const fileResult = insertFile.run(
          record.filePath,
          record.size,
          record.isDocumentation ? 1 : 0,
          record.language,
          record.extension,
          record.contentTruncated ? 1 : 0
        );
        const fileId = Number(fileResult.lastInsertRowid);

        insertFileSearch.run(fileId, record.filePath, record.content);

        for (const symbol of record.symbols) {
          const symbolResult = insertSymbol.run(
            fileId,
            symbol.name,
            symbol.kind,
            symbol.language,
            symbol.signature,
            symbol.doc,
            symbol.startLine,
            symbol.startColumn,
            symbol.endLine,
            symbol.endColumn,
            symbol.isDefinition,
            symbol.isDeclaration
          );
          const symbolId = Number(symbolResult.lastInsertRowid);
          totalSymbols++;

          insertSymbolSearch.run(
            symbolId,
            symbol.name,
            symbol.signature,
            symbol.doc,
            record.filePath,
            symbol.content,
            symbol.kind,
            symbol.language
          );

          for (const member of symbol.members) {
            insertMember.run(symbolId, member.name, member.type, member.line, member.ordinal);
          }

          for (const parameter of symbol.parameters) {
            insertParameter.run(symbolId, parameter.name, parameter.type, parameter.ordinal);
          }

          for (const reference of symbol.references) {
            insertReference.run(symbolId, fileId, reference.line, reference.column);
          }
        }
      }
    }
  );

  for (const relativePath of filePaths) {
    const absolutePath = path.join(repoDir, relativePath);
    try {
      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        continue;
      }

      const { content, truncated } = readFileContent(absolutePath);
      const extension = getFileExtension(relativePath);
      const language = detectLanguage(relativePath);
      const symbols = flattenSymbols(content, relativePath);
      const isDocumentation = /\.(md|rst|txt|adoc|asciidoc)$/i.test(relativePath);

      batches.push({
        filePath: relativePath,
        size: stat.size,
        isDocumentation,
        language,
        extension,
        content,
        contentTruncated: truncated,
        symbols,
      });

      if (truncated) {
        truncatedFiles++;
      }

      processed++;
      if (batches.length >= batchSize) {
        flushBatch(batches);
        batches.length = 0;
      }

      if (processed % 500 === 0) {
        console.log(`   Code index progress: ${processed}/${filePaths.length} files`);
      }
    } catch (error) {
      console.warn(
        `   Skipping code index entry for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (batches.length > 0) {
    flushBatch(batches);
  }

  db.prepare('UPDATE Metadata SET FileCount = ?').run(processed);
  db.exec('ANALYZE;');
  db.close();

  const sizeNote = truncatedFiles > 0 ? `, truncated ${truncatedFiles} large files` : '';
  console.log(`   Code index: ${dbPath} (${processed} files, ${totalSymbols} symbols${sizeNote})`);
}
