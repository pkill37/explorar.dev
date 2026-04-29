/**
 * Next.js plugin to copy Monaco Editor worker files into public/.
 *
 * Only the worker .js files need to be served statically — Monaco's main API
 * is bundled by webpack from node_modules. Copying the entire ESM tree was
 * wasteful (~thousands of files) and inflated the Cloudflare file count.
 */

import type { NextConfig } from 'next';
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';

const MONACO_SOURCE = join(process.cwd(), 'node_modules/monaco-editor/esm/vs');
const MONACO_DEST = join(process.cwd(), 'public/monaco-editor/vs');

// Only the workers Monaco spawns via getWorkerUrl need to live in public/.
// editor.worker  → all languages without a dedicated worker (C, Python, LLVM IR, …)
// json.worker    → JSON language features
// css.worker     → CSS/SCSS/LESS (arbitrary repos)
// html.worker    → HTML (arbitrary repos)
// ts.worker      → TypeScript/JavaScript (arbitrary repos)
const WORKER_FILES = [
  'editor/editor.worker.js',
  'language/json/json.worker.js',
  'language/css/css.worker.js',
  'language/html/html.worker.js',
  'language/typescript/ts.worker.js',
];

function copyMonacoFiles(): void {
  try {
    if (!existsSync(MONACO_SOURCE)) {
      console.warn(`⚠️  Monaco Editor not found in node_modules. Run 'npm install' first.`);
      return;
    }

    console.log('📦 Copying Monaco Editor worker files...');
    const startTime = Date.now();

    if (existsSync(MONACO_DEST)) {
      rmSync(MONACO_DEST, { recursive: true, force: true });
    }

    let copied = 0;
    for (const workerFile of WORKER_FILES) {
      const src = join(MONACO_SOURCE, workerFile);
      const dest = join(MONACO_DEST, workerFile);
      if (existsSync(src)) {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
        copied++;
      } else {
        console.warn(`⚠️  Worker not found: ${workerFile}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Monaco workers copied (${copied}/${WORKER_FILES.length} files, ${duration}ms)`);
  } catch (error) {
    console.error('❌ Error copying Monaco worker files:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

export function withMonacoEditor(nextConfig: NextConfig = {}): NextConfig {
  if (process.env.NODE_ENV !== 'test') {
    copyMonacoFiles();
  }
  return nextConfig;
}
