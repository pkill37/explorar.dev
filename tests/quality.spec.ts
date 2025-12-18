import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Quality and Accessibility Tests
 * Checks for accessibility issues, broken links, and code quality
 */
test.describe('Quality Checks', () => {
  test('homepage has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('repository page has no accessibility violations', async ({ page }) => {
    await page.goto('/torvalds/linux');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('all internal links are valid', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a[href^="/"]');

    const linkCount = await links.count();
    const brokenLinks: string[] = [];

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('#')) {
        const response = await page.request.get(href);
        if (response.status() >= 400) {
          brokenLinks.push(href);
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });

  test('has no broken images', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');

    const count = await images.count();
    const brokenImages: string[] = [];

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http')) {
        const response = await page.request.get(src);
        if (response.status() >= 400) {
          brokenImages.push(src);
        }
      }
    }

    expect(brokenImages).toEqual([]);
  });

  test('has proper color contrast', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    // Filter for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.id === 'color-contrast'
    );
    expect(contrastViolations).toEqual([]);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');

    // Check that interactive elements are focusable
    const interactiveElements = page.locator('a, button, input, select, textarea, [tabindex]');
    const count = await interactiveElements.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = interactiveElements.nth(i);
      const tabIndex = await element.getAttribute('tabindex');
      // Elements should be focusable (tabindex >= 0 or not set for native elements)
      if (tabIndex && parseInt(tabIndex) < 0) {
        throw new Error(`Element has negative tabindex: ${await element.textContent()}`);
      }
    }
  });

  test('has proper ARIA labels where needed', async ({ page }) => {
    await page.goto('/');

    // Check buttons without text have aria-label
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');

      if (!text?.trim() && !ariaLabel && !ariaLabelledBy) {
        throw new Error('Button without text or aria-label found');
      }
    }
  });

  test('forms have proper labels', async ({ page }) => {
    await page.goto('/');

    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type');
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      // Skip hidden inputs
      if (type === 'hidden') continue;

      // Input should have label, aria-label, or aria-labelledby
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelCount = await label.count();
        if (labelCount > 0) continue;
      }

      if (!ariaLabel && !ariaLabelledBy) {
        throw new Error('Form input without proper label found');
      }
    }
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('favicon') && !error.includes('404') && !error.includes('net::ERR_')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('has proper document structure', async ({ page }) => {
    await page.goto('/');

    // Check for DOCTYPE
    const doctype = await page.evaluate(() => document.doctype?.name);
    expect(doctype).toBe('html');

    // Check for html, head, body
    const html = await page.locator('html').count();
    const head = await page.locator('head').count();
    const body = await page.locator('body').count();

    expect(html).toBe(1);
    expect(head).toBe(1);
    expect(body).toBe(1);
  });
});
