import type { Page } from '@playwright/test';

type CorpusFileMap = Record<string, string>;

interface RouteCorpusRepositoryOptions {
  page: Page;
  owner: string;
  repo: string;
  manifest: unknown;
  files: CorpusFileMap;
  routePattern?: string;
  githubContentsPattern?: string;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/^\/+/, '');
}

export async function routeCorpusRepository({
  page,
  owner,
  repo,
  manifest,
  files,
  routePattern = `https://**/repos/${owner}/${repo}/**`,
  githubContentsPattern = `https://api.github.com/repos/${owner}/${repo}/contents/**`,
}: RouteCorpusRepositoryOptions): Promise<void> {
  await page.route(routePattern, async (route) => {
    const url = route.request().url();

    if (url.endsWith('/repo-manifest.json') || url.endsWith('/.repo-manifest.json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: {
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify(manifest),
      });
      return;
    }

    const matchedFilePath = Object.keys(files).find((filePath) =>
      url.endsWith(`/${normalizePath(filePath)}`)
    );

    if (matchedFilePath) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: {
          'access-control-allow-origin': '*',
        },
        body: files[matchedFilePath],
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'text/plain; charset=utf-8',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: 'not found',
    });
  });

  await page.route(githubContentsPattern, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ message: 'Not Found' }),
    });
  });
}
