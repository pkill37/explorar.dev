import { test, expect } from '@playwright/test';
import { CURATED_TEST_REPOS } from './helpers/curated-repos';

/**
 * Sanity checks for the static web app
 * Ensures basic functionality works and pages load without errors
 */
test.describe('Sanity Checks', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/explorar/i);
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    expect(errors).toHaveLength(0);
  });

  test('repository pages load successfully', async ({ page }) => {
    for (const { owner, repo } of CURATED_TEST_REPOS) {
      const response = await page.goto(`/${owner}/${repo}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('robots.txt is accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
    const content = await page.textContent('body');
    expect(content).toContain('User-Agent');
  });

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
    const content = await page.textContent('body');
    expect(content).toContain('urlset');
  });

  test('repository pages expose source selection for on-demand loading', async ({ page }) => {
    for (const { owner, repo } of CURATED_TEST_REPOS) {
      const response = await page.goto(`/${owner}/${repo}`);
      expect(response?.status()).toBe(200);

      const sourceSelect = page.locator('select.vscode-source-select').first();
      await expect(sourceSelect).toHaveValue('r2-bucket');
      await expect(sourceSelect.locator('option[value="r2-bucket"]')).toContainText('R2 bucket');
    }
  });

  test('all images load successfully', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const response = await page.request.get(src);
        expect(response.status()).toBeLessThan(400);
      }
    }
  });
});
