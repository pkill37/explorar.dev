import { test, expect, type Page } from '@playwright/test';
import { routeCorpusRepository } from './helpers/corpus-routing';

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
const TEST_MANIFEST = {
  tree: [
    {
      name: 'top',
      type: 'd',
      children: [{ name: 'main.c', type: 'f' }],
    },
  ],
};

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
  const segments = path.split('/');
  for (let index = 0; index < segments.length - 1; index += 1) {
    const directoryPath = segments.slice(0, index + 1).join('/');
    const directoryItem = page.locator(`[data-file-path="${directoryPath}"]`);
    await expect(directoryItem).toBeVisible();
    await directoryItem.click();
  }

  const fileItem = page.locator(`[data-file-path="${path}"]`);
  await expect(fileItem).toBeVisible();
  await fileItem.click();
}

async function expectDebugLog(
  page: Page,
  predicate: (entry: DebugEntry) => boolean,
  message: string,
  timeout = 30000
): Promise<void> {
  await expect
    .poll(
      async () => {
        const logs = await readDebugLogs(page);
        return logs.some(predicate);
      },
      { timeout, message }
    )
    .toBeTruthy();
}

test.describe('Editor Loading', () => {
  test('renders Monaco after a successful cross-origin static file fetch', async ({ page }) => {
    await routeCorpusRepository({
      page,
      owner: 'littlekernel',
      repo: 'lk',
      manifest: TEST_MANIFEST,
      files: {
        [TEST_FILE_PATH]: TEST_FILE_CONTENT,
      },
    });

    const response = await page.goto('/littlekernel/lk', { waitUntil: 'domcontentloaded' });
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
        entry.label === '[explorar:file-fetch]' &&
        entry.payload?.source === 'local-filesystem' &&
        typeof entry.payload?.requestUrl === 'string' &&
        entry.payload.requestUrl.includes('/repos/littlekernel/lk/') &&
        entry.payload.requestUrl.endsWith(`/${TEST_FILE_PATH}`),
      `Expected local staged corpus fetch for ${TEST_FILE_PATH}`
    );

    await expect(page.getByRole('code').getByText('#include <lk/main.h>')).toBeVisible({
      timeout: 30000,
    });
  });

  test('can switch dev corpus fetches to the configured R2 bucket source', async ({ page }) => {
    await routeCorpusRepository({
      page,
      owner: 'littlekernel',
      repo: 'lk',
      manifest: TEST_MANIFEST,
      files: {
        [TEST_FILE_PATH]: TEST_FILE_CONTENT,
      },
    });

    const response = await page.goto('/littlekernel/lk', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await page.getByLabel('Storage source').selectOption('r2-bucket');
    await resetDebugLogs(page);
    await openGuideFile(page, TEST_FILE_PATH);

    await expectDebugLog(
      page,
      (entry) =>
        entry.label === '[explorar:file-fetch]' &&
        entry.payload?.source === 'r2-bucket' &&
        typeof entry.payload?.requestUrl === 'string' &&
        entry.payload.requestUrl.includes(
          'pub-fed8a8778c5340c9a70aec8e22b8296d.r2.dev/repos/littlekernel/lk/'
        ),
      `Expected R2 bucket fetch for ${TEST_FILE_PATH}`
    );
  });

  test('failed loads surface an error instead of leaving the editor stuck on loading', async ({
    page,
  }) => {
    await routeCorpusRepository({
      page,
      owner: 'littlekernel',
      repo: 'lk',
      manifest: TEST_MANIFEST,
      files: {},
    });

    const response = await page.goto('/littlekernel/lk', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await resetDebugLogs(page);
    await openGuideFile(page, TEST_FILE_PATH);

    await expectDebugLog(
      page,
      (entry) =>
        entry.label === '[explorar:file-load] error' && entry.payload?.filePath === TEST_FILE_PATH,
      `Expected failed file load log for ${TEST_FILE_PATH}`
    );

    await expect(page.getByText('Loading top/main.c...')).not.toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Failed to load file')).toBeVisible({ timeout: 30000 });
  });
});
