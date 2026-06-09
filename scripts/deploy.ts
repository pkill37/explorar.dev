#!/usr/bin/env node
/**
 * Deploy production artifacts to the bucket-backed production infra:
 * - curated corpus assets -> R2
 */

import { fileURLToPath } from 'url';

import { loadDeployEnv } from './deploy-env';
import { runAwsSync, readR2Env } from './deploy-r2';

async function main(): Promise<void> {
  const loadedFiles = loadDeployEnv();
  const r2Env = readR2Env();

  if (loadedFiles.length > 0) {
    console.log(`\nℹ️  Loaded deploy env from: ${loadedFiles.join(', ')}`);
  }

  await runAwsSync(r2Env);
  console.log('\n✅ Production deployment complete.');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nERROR: ${message}\n`);
    process.exit(1);
  });
}
