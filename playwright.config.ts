import { defineConfig, devices } from '@playwright/test';

const NODE_ONLY_TEST_FILES = new Set([
  'tests/code-index-builder.spec.ts',
  'tests/corpus-sqlite-index.spec.ts',
  'tests/deploy-r2.spec.ts',
  'tests/guide-lint.spec.ts',
  'tests/repo-source-routing.spec.ts',
]);

function shouldStartWebServer(): boolean {
  const requestedTestFiles = process.argv
    .slice(2)
    .filter((arg) => arg.endsWith('.spec.ts') || arg.startsWith('tests/'))
    .map((arg) => arg.replace(/^\.\//, ''));

  if (requestedTestFiles.length === 0) {
    return true;
  }

  return !requestedTestFiles.every((file) => NODE_ONLY_TEST_FILES.has(file));
}

/**
 * Playwright configuration for testing the static web app
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'out/playwright-report' }]],
  outputDir: 'out/test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(shouldStartWebServer()
    ? {
        webServer: {
          command:
            'tsx scripts/prepare-public-assets.ts --sqljs && NEXT_OUTPUT_EXPORT=false next dev --turbopack --port 8000',
          url: 'http://localhost:8000',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      }
    : {}),
});
