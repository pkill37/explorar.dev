import { test, expect } from '@playwright/test';

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
    const repos = [
      { owner: 'littlekernel', repo: 'lk' },
      { owner: 'apple-oss-distributions', repo: 'xnu' },
      { owner: 'torvalds', repo: 'linux' },
      { owner: 'python', repo: 'cpython' },
      { owner: 'bminor', repo: 'glibc' },
      { owner: 'llvm', repo: 'llvm-project' },
    ];

    for (const { owner, repo } of repos) {
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

  test('manifest files are accessible', async ({ page }) => {
    const repos = [
      { owner: 'littlekernel', repo: 'lk', branch: 'a521fe60e1a16d5670fe24b7fca2c5155b3339c4' },
      { owner: 'apple-oss-distributions', repo: 'xnu', branch: 'xnu-12377.1.9' },
      { owner: 'torvalds', repo: 'linux', branch: 'v6.1' },
      { owner: 'python', repo: 'cpython', branch: 'v3.12.0' },
      { owner: 'bminor', repo: 'glibc', branch: 'glibc-2.39' },
      { owner: 'llvm', repo: 'llvm-project', branch: 'llvmorg-18.1.0' },
    ];

    for (const { owner, repo, branch } of repos) {
      // Try new manifest name first, fall back to old name for backward compatibility
      let response = await page.goto(`/repos/${owner}/${repo}/${branch}/repo-manifest.json`);
      if (!response?.ok()) {
        response = await page.goto(`/repos/${owner}/${repo}/${branch}/.repo-manifest.json`);
      }
      expect(response?.status()).toBe(200);
      const json = await response?.json();
      expect(json).toHaveProperty('tree');
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
