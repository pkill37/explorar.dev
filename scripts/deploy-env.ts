import fs from 'fs';
import path from 'path';

const ENV_FILES = ['.env.deploy.local', '.env.deploy', '.env.production.local', '.env.production'];

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    const value = normalized.slice(separatorIndex + 1).trim();

    if (!key) continue;
    result[key] = stripWrappingQuotes(value);
  }

  return result;
}

export function loadDeployEnv(): string[] {
  const loadedFiles: string[] = [];

  for (const relativeFile of ENV_FILES) {
    const envPath = path.join(process.cwd(), relativeFile);
    if (!fs.existsSync(envPath)) continue;

    const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    loadedFiles.push(relativeFile);
  }

  return loadedFiles;
}
