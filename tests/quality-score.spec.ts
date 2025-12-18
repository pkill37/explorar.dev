import { test, expect, Page } from '@playwright/test';

/**
 * Quality Scoring Tests
 * Calculates overall quality score based on multiple metrics
 */
test.describe('Quality Scoring', () => {
  interface QualityMetrics {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
    total: number;
  }

  async function calculateQualityScore(page: Page, url: string): Promise<QualityMetrics> {
    await page.goto(url, { waitUntil: 'networkidle' });

    // Performance Score (0-100)
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

      const ttfb = navigation.responseStart - navigation.requestStart;
      const fcp = fcpEntry ? fcpEntry.startTime : 0;
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;

      // Score based on thresholds
      let score = 100;
      if (ttfb > 800) score -= 20;
      if (fcp > 1800) score -= 20;
      if (domContentLoaded > 3000) score -= 20;
      if (ttfb > 1200 || fcp > 3000 || domContentLoaded > 5000) score -= 20;

      return Math.max(0, score);
    });

    // Accessibility Score (0-100) - simplified check
    const accessibilityScore = await page.evaluate(() => {
      let score = 100;
      const issues: string[] = [];

      // Check for missing alt text
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        if (!img.getAttribute('alt') && img.getAttribute('role') !== 'presentation') {
          issues.push('missing-alt');
        }
      });

      // Check for missing labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input) => {
        if (input.getAttribute('type') === 'hidden') return;
        const id = input.getAttribute('id');
        if (id && !document.querySelector(`label[for="${id}"]`)) {
          if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
            issues.push('missing-label');
          }
        }
      });

      // Deduct points for issues
      score -= issues.length * 5;
      return Math.max(0, score);
    });

    // SEO Score (0-100)
    const seoScore = await page.evaluate(() => {
      let score = 100;

      // Check for title
      const title = document.title;
      if (!title || title.length < 10 || title.length > 60) score -= 20;

      // Check for meta description
      const description = document.querySelector('meta[name="description"]');
      if (!description) {
        score -= 20;
      } else {
        const content = description.getAttribute('content') || '';
        if (content.length < 50 || content.length > 160) score -= 10;
      }

      // Check for viewport
      const viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) score -= 10;

      // Check for h1
      const h1 = document.querySelector('h1');
      if (!h1) score -= 10;

      // Check for canonical
      const canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) score -= 10;

      return Math.max(0, score);
    });

    // Best Practices Score (0-100)
    const bestPracticesScore = await page.evaluate(() => {
      let score = 100;

      // Check for HTTPS (in production)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        score -= 20;
      }

      // Check for proper charset
      const charset = document.querySelector('meta[charset]');
      if (!charset || charset.getAttribute('charset') !== 'utf-8') {
        score -= 10;
      }

      // Check for lang attribute
      const html = document.documentElement;
      if (!html.getAttribute('lang')) {
        score -= 10;
      }

      return Math.max(0, score);
    });

    const total = (performanceMetrics + accessibilityScore + seoScore + bestPracticesScore) / 4;

    return {
      performance: performanceMetrics,
      accessibility: accessibilityScore,
      seo: seoScore,
      bestPractices: bestPracticesScore,
      total,
    };
  }

  test('homepage quality score meets threshold', async ({ page }) => {
    const scores = await calculateQualityScore(page, '/');

    console.log('Quality Scores:', scores);

    // Each category should be at least 70
    expect(scores.performance).toBeGreaterThanOrEqual(70);
    expect(scores.accessibility).toBeGreaterThanOrEqual(70);
    expect(scores.seo).toBeGreaterThanOrEqual(70);
    expect(scores.bestPractices).toBeGreaterThanOrEqual(70);

    // Total score should be at least 75
    expect(scores.total).toBeGreaterThanOrEqual(75);
  });

  test('repository page quality score meets threshold', async ({ page }) => {
    const scores = await calculateQualityScore(page, '/torvalds/linux');

    console.log('Quality Scores:', scores);

    expect(scores.performance).toBeGreaterThanOrEqual(70);
    expect(scores.accessibility).toBeGreaterThanOrEqual(70);
    expect(scores.seo).toBeGreaterThanOrEqual(70);
    expect(scores.total).toBeGreaterThanOrEqual(75);
  });

  test('generates quality report', async ({ page }) => {
    const pages = ['/', '/torvalds/linux', '/python/cpython'];
    const report: Record<string, QualityMetrics> = {};

    for (const url of pages) {
      report[url] = await calculateQualityScore(page, url);
    }

    console.log('\n=== Quality Report ===');
    for (const [url, scores] of Object.entries(report)) {
      console.log(`\n${url}:`);
      console.log(`  Performance: ${scores.performance.toFixed(1)}/100`);
      console.log(`  Accessibility: ${scores.accessibility.toFixed(1)}/100`);
      console.log(`  SEO: ${scores.seo.toFixed(1)}/100`);
      console.log(`  Best Practices: ${scores.bestPractices.toFixed(1)}/100`);
      console.log(`  Total: ${scores.total.toFixed(1)}/100`);
    }

    // Verify all pages meet minimum thresholds
    for (const scores of Object.values(report)) {
      expect(scores.total).toBeGreaterThanOrEqual(75);
    }
  });
});
