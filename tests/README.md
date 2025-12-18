# Test Suite for Static Web App

This directory contains comprehensive tests for the static web application, including sanity checks, performance metrics, SEO validation, and quality scoring.

## Test Categories

### 1. Sanity Checks (`sanity.spec.ts`)

Basic functionality tests to ensure the app works correctly:

- Pages load successfully
- No console errors
- Repository pages are accessible
- Static assets (robots.txt, sitemap.xml) are available
- Manifest files are accessible
- Images load correctly

### 2. Web Vitals Performance (`web-vitals.spec.ts`)

Performance metrics based on Core Web Vitals:

- **LCP (Largest Contentful Paint)**: Should be < 2.5s
- **FCP (First Contentful Paint)**: Should be < 1.8s
- **TTFB (Time to First Byte)**: Should be < 800ms
- **CLS (Cumulative Layout Shift)**: Should be < 0.1
- Bundle size checks
- Layout shift detection

### 3. SEO Tests (`seo.spec.ts`)

Search engine optimization validation:

- Meta tags (title, description, viewport)
- Open Graph tags
- Twitter Card tags
- robots.txt format
- sitemap.xml validity
- Canonical URLs
- Heading hierarchy
- Semantic HTML
- Image alt text
- Language attributes

### 4. Quality Checks (`quality.spec.ts`)

Accessibility and code quality:

- Accessibility violations (using axe-core)
- Broken links detection
- Broken images detection
- Color contrast
- Keyboard navigation
- ARIA labels
- Form labels
- Console errors
- Document structure

### 5. Quality Scoring (`quality-score.spec.ts`)

Overall quality score calculation:

- Performance score (0-100)
- Accessibility score (0-100)
- SEO score (0-100)
- Best practices score (0-100)
- Total quality score
- Quality report generation

## Running Tests

```bash
# Run All Tests
npm test

# Sanity checks only
npm run test:sanity

# Performance tests only
npm run test:performance

# SEO tests only
npm run test:seo

# Quality tests only
npm run test:quality

# Quality scoring only
npm run test:score

# Interactive UI Mode
npm run test:ui

# View Test Report
npm run test:report
```

## Prerequisites

1. Build the static app first:

   ```bash
   npm run build
   ```

2. The tests will automatically start a local HTTP server on port 8000 to serve the `out/` directory.

## Test Configuration

Tests are configured in `playwright.config.ts`. The default base URL is `http://localhost:8000`, which can be overridden with the `BASE_URL` environment variable:

```bash
BASE_URL=http://localhost:3000 npm test
```

## Quality Thresholds

The tests enforce the following quality thresholds:

- **Performance**: Minimum 70/100
- **Accessibility**: Minimum 70/100
- **SEO**: Minimum 70/100
- **Best Practices**: Minimum 70/100
- **Total Score**: Minimum 75/100

## Continuous Integration

These tests are designed to run in CI/CD pipelines. Set the `CI` environment variable to enable CI-specific settings:

```bash
CI=true npm test
```

In CI mode:

- Tests will retry up to 2 times on failure
- Only 1 worker will be used
- Existing server won't be reused

## Troubleshooting

### Tests fail with "Server not ready"

- Ensure the build completed successfully: `npm run build`
- Check that the `out/` directory exists
- Verify port 8000 is not in use

### Performance tests fail

- Run tests on a clean system (close other applications)
- Ensure network conditions are stable
- Some metrics may vary based on system load

### Accessibility tests fail

- Review the HTML report for specific violations
- Fix issues in the source code
- Re-run tests to verify fixes
