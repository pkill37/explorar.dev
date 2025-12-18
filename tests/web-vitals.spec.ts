import { test, expect } from '@playwright/test';

/**
 * Web Vitals Performance Tests
 * Measures Core Web Vitals: LCP, FID, CLS, FCP, TTFB
 */
test.describe('Web Vitals Performance', () => {
  test('homepage meets performance thresholds', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Measure Largest Contentful Paint (LCP)
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          resolve(lastEntry.renderTime || lastEntry.loadTime || 0);
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        setTimeout(() => resolve(0), 5000);
      });
    });

    // LCP should be under 2.5s for good performance
    expect(lcp).toBeLessThan(2500);

    // Measure First Contentful Paint (FCP)
    const fcp = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : 0;
    });

    // FCP should be under 1.8s
    expect(fcp).toBeLessThan(1800);

    // Measure Time to First Byte (TTFB)
    const ttfb = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return navigation.responseStart - navigation.requestStart;
    });

    // TTFB should be under 800ms
    expect(ttfb).toBeLessThan(800);
  });

  test('repository page meets performance thresholds', async ({ page }) => {
    await page.goto('/torvalds/linux', { waitUntil: 'networkidle' });

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

      return {
        ttfb: navigation.responseStart - navigation.requestStart,
        fcp: fcpEntry ? fcpEntry.startTime : 0,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
      };
    });

    expect(metrics.ttfb).toBeLessThan(800);
    expect(metrics.fcp).toBeLessThan(1800);
    expect(metrics.domContentLoaded).toBeLessThan(3000);
    expect(metrics.loadComplete).toBeLessThan(5000);
  });

  test('measures Cumulative Layout Shift (CLS)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!layoutShift.hadRecentInput && layoutShift.value !== undefined) {
              clsValue += layoutShift.value;
            }
          }
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        setTimeout(() => resolve(clsValue), 5000);
      });
    });

    // CLS should be under 0.1 for good performance
    expect(cls).toBeLessThan(0.1);
  });

  test('bundle size is reasonable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((entry) => {
        const resourceEntry = entry as PerformanceResourceTiming;
        return {
          name: resourceEntry.name,
          size: resourceEntry.transferSize,
          type: resourceEntry.initiatorType,
        };
      });
    });

    const jsResources = resources.filter((r) => r.type === 'script');
    const totalJSSize = jsResources.reduce((sum: number, r) => sum + r.size, 0);

    // Total JS should be under 2MB (compressed)
    expect(totalJSSize).toBeLessThan(2 * 1024 * 1024);
  });

  test('no layout shifts during page load', async ({ page }) => {
    const layoutShifts: number[] = [];

    page.on('load', async () => {
      const shifts = await page.evaluate(() => {
        return new Promise<number[]>((resolve) => {
          const shifts: number[] = [];
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutShift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput && layoutShift.value !== undefined) {
                shifts.push(layoutShift.value);
              }
            }
          });
          observer.observe({ entryTypes: ['layout-shift'] });
          setTimeout(() => resolve(shifts), 3000);
        });
      });
      layoutShifts.push(...shifts);
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Check that major layout shifts (>0.1) don't occur
    const majorShifts = layoutShifts.filter((shift) => shift > 0.1);
    expect(majorShifts).toHaveLength(0);
  });
});
