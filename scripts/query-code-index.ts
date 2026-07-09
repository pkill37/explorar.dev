#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

function fail(message: string): never {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function isReadOnlyQuery(sql: string): boolean {
  return /^(?:select|with|pragma|explain)\b/i.test(sql.trim());
}

function formatValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }
  return value;
}

function main(): void {
  const [databasePathArg, ...queryParts] = process.argv.slice(2);
  if (!databasePathArg || queryParts.length === 0) {
    fail('Usage: tsx scripts/query-code-index.ts <path-to-code-index.sqlite> "<SQL query>"');
  }

  const databasePath = path.resolve(databasePathArg);
  if (!fs.existsSync(databasePath)) {
    fail(`Database not found: ${databasePath}`);
  }

  const sql = queryParts.join(' ').trim();
  if (!isReadOnlyQuery(sql)) {
    fail('Only read-only SQL statements are allowed.');
  }

  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(sql)
      .all()
      .map((row: Record<string, unknown>) => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[key] = formatValue(value);
        }
        return normalized;
      });
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
