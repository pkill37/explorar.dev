import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const OUT_DIR = path.join(process.cwd(), 'out');
const MAX_INITIAL_JS_GZIP = 240 * 1024;
const MAX_INITIAL_CSS_GZIP = 15 * 1024;
const ROUTES = [
  { label: 'Homepage', htmlPath: path.join(OUT_DIR, 'index.html') },
  { label: 'Technology page', htmlPath: path.join(OUT_DIR, 'technology', 'index.html') },
] as const;
const FORBIDDEN_INITIAL_PAYLOAD = ['monaco-editor', 'sql-wasm', 'html2canvas', '@dagrejs'];

function referencedAssets(html: string, extension: 'js' | 'css'): string[] {
  const expression = new RegExp(`/_next/static/[^"'\\s]+\\.${extension}`, 'g');
  return [...new Set(html.match(expression) ?? [])];
}

function gzipSize(assetPaths: string[]): number {
  return assetPaths.reduce((total, assetPath) => {
    const absolutePath = path.join(OUT_DIR, assetPath.replace(/^\//, ''));
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Referenced asset is missing from the export: ${assetPath}`);
    }
    return total + gzipSync(fs.readFileSync(absolutePath)).byteLength;
  }, 0);
}

for (const route of ROUTES) {
  if (!fs.existsSync(route.htmlPath)) {
    throw new Error(
      `${path.relative(process.cwd(), route.htmlPath)} is missing. Run the production build before this check.`
    );
  }

  const html = fs.readFileSync(route.htmlPath, 'utf8');
  const scripts = referencedAssets(html, 'js');
  const styles = referencedAssets(html, 'css');
  const jsBytes = gzipSize(scripts);
  const cssBytes = gzipSize(styles);

  console.log(`${route.label} initial JS (gzip): ${(jsBytes / 1024).toFixed(1)} KB`);
  console.log(`${route.label} initial CSS (gzip): ${(cssBytes / 1024).toFixed(1)} KB`);

  if (jsBytes > MAX_INITIAL_JS_GZIP) {
    throw new Error(`${route.label} JS exceeds 240 KB gzip (${(jsBytes / 1024).toFixed(1)} KB).`);
  }
  if (cssBytes > MAX_INITIAL_CSS_GZIP) {
    throw new Error(`${route.label} CSS exceeds 15 KB gzip (${(cssBytes / 1024).toFixed(1)} KB).`);
  }

  for (const marker of FORBIDDEN_INITIAL_PAYLOAD) {
    if (
      scripts.some((assetPath) =>
        fs.readFileSync(path.join(OUT_DIR, assetPath.slice(1)), 'utf8').includes(marker)
      )
    ) {
      throw new Error(`${route.label} initial JavaScript unexpectedly contains ${marker}.`);
    }
  }
}
