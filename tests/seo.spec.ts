import { test, expect } from '@playwright/test';

/**
 * SEO Tests
 * Validates meta tags, structured data, robots.txt, sitemap, etc.
 */
test.describe('SEO Checks', () => {
  test('homepage has required meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThan(60);

    // Check for meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description?.length).toBeGreaterThan(50);
    expect(description?.length).toBeLessThan(160);

    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();

    // Check for charset
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset).toBe('utf-8');
  });

  test('repository pages have proper meta tags', async ({ page }) => {
    await page.goto('/torvalds/linux');

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title).toContain('linux');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('has Open Graph meta tags', async ({ page }) => {
    await page.goto('/');

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');

    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
    expect(ogType).toBeTruthy();
  });

  test('has Twitter Card meta tags', async ({ page }) => {
    await page.goto('/');

    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');

    expect(twitterCard).toBeTruthy();
    expect(twitterTitle).toBeTruthy();
  });

  test('robots.txt is properly formatted', async ({ page }) => {
    await page.goto('/robots.txt');
    const content = await page.textContent('body');

    expect(content).toContain('User-agent');
    expect(content).toContain('Allow:');
    expect(content).toContain('Sitemap:');
  });

  test('sitemap.xml is valid', async ({ page }) => {
    await page.goto('/sitemap.xml');
    const content = await page.textContent('body');

    expect(content).toContain('urlset');
    expect(content).toContain('xmlns');
    expect(content).toContain('url');
    expect(content).toContain('loc');
  });

  test('sitemap contains all repository pages', async ({ page }) => {
    await page.goto('/sitemap.xml');
    const content = await page.textContent('body');

    const repos = ['torvalds/linux', 'python/cpython', 'bminor/glibc', 'llvm/llvm-project'];
    for (const repo of repos) {
      expect(content).toContain(repo);
    }
  });

  test('has canonical URLs', async ({ page }) => {
    await page.goto('/');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();
  });

  test('has proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check for h1
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
    expect(h1).toBeLessThanOrEqual(1); // Should have exactly one h1

    // Check that headings are in order (no h3 without h2, etc.)
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
      elements.map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim() || '',
      }))
    );

    let lastLevel = 0;
    for (const heading of headings) {
      const level = parseInt(heading.tag.charAt(1));
      // Allow skipping levels down but not up
      if (lastLevel > 0 && level > lastLevel + 1) {
        // This is a warning, not a failure, but we'll log it
        console.warn(`Heading hierarchy issue: ${heading.tag} after h${lastLevel}`);
      }
      lastLevel = level;
    }
  });

  test('has semantic HTML structure', async ({ page }) => {
    await page.goto('/');

    // Check for semantic elements
    const main = await page.locator('main').count();
    const nav = await page.locator('nav').count();
    const header = await page.locator('header').count();

    // At least one semantic element should be present
    expect(main + nav + header).toBeGreaterThan(0);
  });

  test('has proper alt text for images', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');

    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Images should have alt text or be decorative (role="presentation")
      if (!alt && role !== 'presentation') {
        const src = await img.getAttribute('src');
        throw new Error(`Image missing alt text: ${src}`);
      }
    }
  });

  test('has proper lang attribute', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
    expect(lang?.length).toBeGreaterThan(0);
  });
});
