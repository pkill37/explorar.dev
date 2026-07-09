import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { CURATED_REPOS } from '@/lib/curated-repos';

type SqlJsResponse = {
  url: string;
  status: number;
};

const LITTLE_KERNEL_REPO = CURATED_REPOS.find(
  (repo) => repo.owner === 'littlekernel' && repo.repo === 'lk'
);

if (!LITTLE_KERNEL_REPO) {
  throw new Error('Missing curated Little Kernel repo config');
}

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const LITTLE_KERNEL_REPO_ROOT = path.resolve(
  TEST_DIR,
  '..',
  'repos',
  LITTLE_KERNEL_REPO.owner,
  LITTLE_KERNEL_REPO.repo
);

async function startCorpusServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = requestUrl.pathname;
    const repoPrefix = '/repos/littlekernel/lk/';

    if (!pathname.startsWith(repoPrefix)) {
      response.writeHead(404, {
        'access-control-allow-origin': '*',
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('not found');
      return;
    }

    const repoRelativePath = pathname.slice(repoPrefix.length);
    const absolutePath = path.join(LITTLE_KERNEL_REPO_ROOT, repoRelativePath);

    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      response.writeHead(404, {
        'access-control-allow-origin': '*',
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('not found');
      return;
    }

    const contentType = absolutePath.endsWith('.sqlite')
      ? 'application/octet-stream'
      : absolutePath.endsWith('.json')
        ? 'application/json; charset=utf-8'
        : 'text/plain; charset=utf-8';

    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-type': contentType,
    });
    fs.createReadStream(absolutePath).pipe(response);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start corpus server');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function waitForDebugLog(page: Page, label: string, timeout = 30000): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          (targetLabel) =>
            (window.__explorarDebugLogs ?? []).some((entry) => entry.label === targetLabel),
          label
        ),
      { timeout, message: `Expected browser debug log ${label}` }
    )
    .toBeTruthy();
}

test.describe('SQL.js browser runtime', () => {
  test('loads the Little Kernel search index with the published wasm asset', async ({ page }) => {
    const pageErrors: string[] = [];
    const sqlJsResponses: SqlJsResponse[] = [];
    const corpusServer = await startCorpusServer();

    try {
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/sqljs/')) {
          sqlJsResponses.push({ url, status: response.status() });
        }
      });

      await page.addInitScript(
        ({ baseUrl }) => {
          const originalFetch = window.fetch.bind(window);

          window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const requestUrl =
              typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (
              requestUrl.includes(
                'pub-fed8a8778c5340c9a70aec8e22b8296d.r2.dev/repos/littlekernel/lk/'
              )
            ) {
              const localUrl = requestUrl.replace(
                /^https?:\/\/pub-fed8a8778c5340c9a70aec8e22b8296d\.r2\.dev/,
                baseUrl
              );
              if (typeof input === 'string' || input instanceof URL) {
                return originalFetch(localUrl, init);
              }
              return originalFetch(new Request(localUrl, input), init);
            }

            return originalFetch(input, init);
          };
        },
        { baseUrl: corpusServer.baseUrl }
      );

      const response = await page.goto('/little-kernel/');
      expect(response?.status()).toBe(200);

      await page.getByRole('button', { name: 'File search' }).click();
      await page.locator('.vscode-tree-search-input').fill('main');

      await waitForDebugLog(page, '[explorar:code-index-static] success');

      await expect
        .poll(
          async () => sqlJsResponses.some((entry) => entry.url.endsWith('/sql-wasm-browser.wasm')),
          {
            timeout: 30000,
            message: 'Expected sql-wasm-browser.wasm to be requested by the browser runtime',
          }
        )
        .toBeTruthy();

      expect(sqlJsResponses.filter((entry) => entry.status >= 400)).toEqual([]);
      expect(pageErrors).toEqual([]);

      const wasmResponse = await page.request.get('/sqljs/sql-wasm-browser.wasm');
      expect(wasmResponse.status()).toBe(200);
    } finally {
      await corpusServer.close();
    }
  });
});
