# Development Guide

Complete guide for developing explorar.dev locally.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Available Commands](#available-commands)
- [Architecture Overview](#architecture-overview)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
npm install
npm run dev
```

Opens at http://localhost:3000. The `predev` script automatically downloads the Python/CPython repository for local testing (this may take a minute on first run).

---

## Environment Configuration

### Environment Files

| File               | Purpose                                         | Committed to Git   |
| ------------------ | ----------------------------------------------- | ------------------ |
| `.env.development` | Development defaults (`NODE_ENV=development`)   | ✅ Yes             |
| `.env.production`  | Production defaults (`NODE_ENV=production`)     | ✅ Yes             |
| `.env.local`       | Personal overrides (highest priority)           | ❌ No (gitignored) |
| `.env.example`     | Template showing all available variables        | ✅ Yes             |

### Environment Variable Reference

| Variable                     | Required | Default                | Description                  |
| ---------------------------- | -------- | ---------------------- | ---------------------------- |
| `NEXT_PUBLIC_SITE_URL`       | No       | `https://explorar.dev` | Site URL for metadata        |
| `NEXT_PUBLIC_GUIDES_API_URL` | No       | -                      | AI guides API URL (optional) |
| `NEXT_PUBLIC_GUIDES_API_KEY` | No       | -                      | AI guides API key (optional) |

All variables are `NEXT_PUBLIC_` — there is no backend or server-side configuration.

---

## Available Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (runs predev first)
npm run predev           # Download Python/CPython repo for local testing

# Building & Deployment
npm run build            # Build static export to out/ (runs prebuild first)
npm run prebuild         # Download curated repos at build time
npm run clean            # Remove build artifacts and downloaded repos

# Code Quality
npm run lint             # TypeScript + ESLint + depcheck (0 warnings required)
npm run fix              # Auto-fix ESLint, format with Prettier

# Testing
npm test                 # Run all Playwright tests (requires static build)
npm run test:sanity      # Basic functionality tests
npm run test:performance # Core Web Vitals tests
npm run test:seo         # SEO validation
npm run test:ui          # Interactive test UI
```

---

## Architecture Overview

This is a **pure frontend** application — no backend, no server, no authentication.

```
Browser
├── Next.js Static Site (out/)
│   ├── Repository Explorer (VS Code-like UI)
│   ├── Monaco Editor
│   └── IndexedDB Storage (repos, file cache)
│
├── Curated Repos → /public/repos/ (pre-downloaded at build time)
│
└── Arbitrary Repos → GitHub API (unauthenticated, 60 req/hr)
```

### Repository Modes

**Curated (Static):** Pre-downloaded at build time via `scripts/download-repos.ts`. Files served from `/public/repos/[owner]/[repo]/[branch]/`. No API calls needed after build.

**Arbitrary (Dynamic):** User-entered repos downloaded on-demand to IndexedDB via `github-archive.ts`. Files lazy-loaded when opened.

---

## Testing

Tests require a static build:

```bash
npm run build
npm test
```

Or target a running dev server:

```bash
BASE_URL=http://localhost:3000 npm test
```

---

## Deployment

Build and deploy the static `out/` directory to any static host (Netlify, Vercel, S3, etc.):

```bash
npm run build
# Deploy out/ directory
```

Curated repos are included in `out/repos/` after build.

---

## Troubleshooting

### Repository Files Not Loading

**Symptoms:** Opening a repository shows "Repository not downloaded" error.

**Why:** Curated repos are downloaded during `predev`/`prebuild`. The `predev` script only downloads CPython by default.

**Solution:**

```bash
# Download a specific repository
tsx scripts/download-repos.ts --only=torvalds/linux --depth=1
npm run dev

# Or download all curated repositories
npm run prebuild
npm run dev
```

**Available curated repositories:**
- `torvalds/linux` — Linux Kernel (v6.1)
- `python/cpython` — Python (v3.12.0)
- `bminor/glibc` — GNU C Library (glibc-2.39)
- `llvm/llvm-project` — LLVM (llvmorg-18.1.0)

```bash
# List all available repos
tsx scripts/download-repos.ts --list
```

### Port Already in Use

```bash
lsof -ti:3000 | xargs kill -9
```

### Environment Variables Not Updating

Restart the dev server — environment variables are read at startup.

### Lint Failures

```bash
npm run fix    # Auto-fix most issues
npm run lint   # Check remaining issues
```

---

## Need Help?

- **Architecture Details**: Check `CLAUDE.md`
