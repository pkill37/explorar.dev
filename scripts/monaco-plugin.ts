/**
 * Next.js plugin to automatically copy Monaco Editor files
 * This runs during both dev and build, ensuring Monaco files are always available
 */

import type { NextConfig } from 'next';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';

const MONACO_SOURCE = join(process.cwd(), 'node_modules/monaco-editor/esm/vs');
const MONACO_DEST = join(process.cwd(), 'public/monaco-editor/vs');

function copyRecursive(src: string, dest: string): void {
  if (!existsSync(src)) {
    console.warn(`⚠️  Monaco source not found: ${src}`);
    return;
  }

  const stats = statSync(src);

  if (stats.isDirectory()) {
    // Create destination directory if it doesn't exist
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    // Copy all files and subdirectories
    const entries = readdirSync(src);
    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      copyRecursive(srcPath, destPath);
    }
  } else {
    // Copy file
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
  }
}

function copyMonacoFiles(): void {
  try {
    if (!existsSync(MONACO_SOURCE)) {
      console.warn(`⚠️  Monaco Editor not found in node_modules. Run 'npm install' first.`);
      return;
    }

    console.log('📦 Copying Monaco Editor ESM files...');
    const startTime = Date.now();

    // Remove existing destination if it exists to ensure clean copy
    if (existsSync(MONACO_DEST)) {
      rmSync(MONACO_DEST, { recursive: true, force: true });
    }

    copyRecursive(MONACO_SOURCE, MONACO_DEST);

    const duration = Date.now() - startTime;
    console.log(`✅ Monaco Editor files copied successfully (${duration}ms)`);
  } catch (error) {
    console.error('❌ Error copying Monaco Editor files:', error);
    // Don't throw in non-production to allow dev server to start
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

/**
 * Next.js plugin that copies Monaco Editor files
 * This runs before the build starts
 */
export function withMonacoEditor(nextConfig: NextConfig = {}): NextConfig {
  // Copy Monaco files when the config is loaded (during build/dev startup)
  if (process.env.NODE_ENV !== 'test') {
    copyMonacoFiles();
  }

  return nextConfig;
}
