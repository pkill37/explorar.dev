import { test, expect, type Page } from '@playwright/test';

type DebugEntry = {
  label: string;
  payload?: Record<string, unknown>;
  timestamp: string;
};

const TEST_FILE_PATH = 'top/main.c';
const TEST_FILE_CONTENT = `#include <lk/main.h>

int main(void) {
  return 0;
}
`;

async function resetDebugLogs(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__explorarDebugLogs = [];
  });
}

async function readDebugLogs(page: Page): Promise<DebugEntry[]> {
  return page.evaluate(
    () =>
      (window.__explorarDebugLogs ?? []) as Array<{
        label: string;
        payload?: Record<string, unknown>;
        timestamp: string;
      }>
  );
}

async function openGuideFile(page: Page, path: string): Promise<void> {
  await page
    .getByRole('button', { name: new RegExp(path.replace('.', '\\.'), 'i') })
    .first()
    .click();
}

async function routeStaticCorpus(page: Page, mainFileStatus: number): Promise<void> {
  await page.route('https://**/repos/littlekernel/lk/**', async (route) => {
    const url = route.request().url();

    if (url.endsWith(`/${TEST_FILE_PATH}`)) {
      await route.fulfill({
        status: mainFileStatus,
        contentType: 'text/plain; charset=utf-8',
        headers: {
          'access-control-allow-origin': '*',
        },
        body: mainFileStatus === 200 ? TEST_FILE_CONTENT : 'not found',
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
}

async function routeGitHubContents(page: Page, mainFileStatus: number): Promise<void> {
  await page.route('https://api.github.com/repos/littlekernel/lk/contents/**', async (route) => {
    const url = route.request().url();

    if (url.includes('top%2Fmain.c')) {
      if (mainFileStatus === 200) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(TEST_FILE_CONTENT, 'utf8').toString('base64'),
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ message: 'Not Found' }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ message: 'Not Found' }),
    });
  });
}

async function expectDebugLog(
  page: Page,
  predicate: (entry: DebugEntry) => boolean,
  message: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const logs = await readDebugLogs(page);
        return logs.some(predicate);
      },
      { timeout: 15000, message }
    )
    .toBeTruthy();
}

test.describe('Editor Loading', () => {
  test('renders Monaco after a successful cross-origin static file fetch', async ({ page }) => {
    await routeStaticCorpus(page, 200);
    await routeGitHubContents(page, 404);

    const response = await page.goto('/littlekernel/lk');
    expect(response?.status()).toBe(200);

    await resetDebugLogs(page);
    await openGuideFile(page, TEST_FILE_PATH);

    await expectDebugLog(
      page,
      (entry) =>
        entry.label === '[explorar:file-load] success' &&
        entry.payload?.filePath === TEST_FILE_PATH,
      `Expected successful file load for ${TEST_FILE_PATH}`
    );

    await expectDebugLog(
      page,
      (entry) =>
        (entry.label === '[explorar:monaco] mount' ||
          entry.label === '[explorar:monaco] model-sync' ||
          entry.label === '[explorar:monaco] model-already-synced') &&
        entry.payload?.filePath === TEST_FILE_PATH,
      `Expected Monaco sync log for ${TEST_FILE_PATH}`
    );

    await expect(page.locator('.monaco-editor').first()).toBeVisible();
    await expect(page.locator('.monaco-editor .view-lines').first()).toContainText(
      '#include <lk/main.h>',
      { timeout: 15000 }
    );
  });

  test('failed loads surface an error instead of leaving the editor stuck on loading', async ({
    page,
  }) => {
    await routeStaticCorpus(page, 404);
    await routeGitHubContents(page, 404);

    const response = await page.goto('/littlekernel/lk');
    expect(response?.status()).toBe(200);

    await resetDebugLogs(page);
    await openGuideFile(page, TEST_FILE_PATH);

    await expectDebugLog(
      page,
      (entry) =>
        entry.label === '[explorar:file-load] error' && entry.payload?.filePath === TEST_FILE_PATH,
      `Expected failed file load log for ${TEST_FILE_PATH}`
    );

    await expect(page.getByText('Loading top/main.c...')).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Failed to load file')).toBeVisible({ timeout: 15000 });
  });
});
