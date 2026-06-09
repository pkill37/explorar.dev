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

Opens at http://localhost:3000. The `predev` script automatically downloads the main curated development repos for local testing (this may take a minute on first run).

---

## Environment Configuration

### Environment Files

| File               | Purpose                                       | Committed to Git   |
| ------------------ | --------------------------------------------- | ------------------ |
| `.env.development` | Development defaults (`NODE_ENV=development`) | ✅ Yes             |
| `.env.production`  | Production defaults (`NODE_ENV=production`)   | ✅ Yes             |
| `.env.local`       | Personal overrides (highest priority)         | ❌ No (gitignored) |
| `.env.example`     | Template showing all available variables      | ✅ Yes             |

### Environment Variable Reference

| Variable                               | Required | Default                | Description                                                                     |
| -------------------------------------- | -------- | ---------------------- | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | No       | `https://explorar.dev` | Site URL for metadata                                                           |
| `NEXT_PUBLIC_CURATED_CONTENT_BASE_URL` | No       | -                      | Remote site/base URL for curated `/repos/*` fetches during local testing        |
| `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`       | No       | -                      | Direct public R2/custom-domain base URL used by the `R2 bucket` source selector |
| `NEXT_PUBLIC_GUIDES_API_URL`           | No       | -                      | AI guides API URL (optional)                                                    |
| `NEXT_PUBLIC_GUIDES_API_KEY`           | No       | -                      | AI guides API key (optional)                                                    |

All variables are `NEXT_PUBLIC_` — there is no backend or server-side configuration.

Set `NEXT_PUBLIC_CURATED_CONTENT_BASE_URL=https://explorar.dev` in `.env.local` when you want local development to read curated source files from the remote deployment origin instead of the local corpus mirror.

Set `NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://r2.example.com` in `.env.local` when you want the `R2 bucket` source option in the UI to hit a direct public R2/custom-domain origin.

---

## Available Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (runs predev first)
npm run predev           # Download curated repos for local testing

# Building & Deployment
npm run build            # Build static export to out/ (runs prebuild first)
npm run prebuild         # Download curated repos at build time
npm run deploy           # Build + sync corpus assets to R2
npm run deploy:r2        # Sync corpus repos/avatars to R2
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
├── Curated Repo Corpus → /repos/ (downloaded before build)
│   └── mirrored into /public/repos/ for local dev only
│
└── Arbitrary Repos → GitHub API (unauthenticated, 60 req/hr)
```

### Repository Modes

**Curated (Static):** Downloaded into the local corpus via `scripts/download-repos.ts`. In local dev the corpus is mirrored into `/public/repos/[owner]/[repo]/[branch]/`; in production curated files are fetched from a direct public bucket/custom-domain origin. No GitHub API calls are needed for curated repos.

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

Production uses manual R2 sync for the corpus assets:

- `R2` receives the separate corpus repo assets (`repos/`)
- the static shell can still be deployed to any host from `out/` if needed

### First-Time Deploy

1. Put these credentials in `.env.local`:

- `R2_BUCKET_NAME`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

2. Run the production deploy:

```bash
npm run deploy
```

`npm run deploy` now:

1. builds `out/`
2. syncs the corpus repos to `s3://<bucket>/repos/`

The R2 sync path intentionally relies on `aws s3 sync --size-only` against the Cloudflare R2 S3-compatible endpoint. That keeps changed files flowing while avoiding false-positive reuploads caused by R2 timestamp drift, and still removes stale remote files with `--delete`.

The deploy scripts auto-load, in order:

- `.env.local`
- `.env.production.local`
- `.env.production`

Shell-exported variables still take precedence over file values.

### Deploy Targets

```bash
npm run deploy:r2
```

Use `deploy:r2` when you only need to refresh bucket-backed corpus assets.

### Tooling Notes

- `deploy:r2` requires an `aws` CLI on your machine.

The R2 bucket is the canonical mirror for corpus artifacts.

---

## Troubleshooting

### Repository Files Not Loading

**Symptoms:** Opening a repository shows "Repository not downloaded" error.

**Why:** Curated repos are downloaded during `predev`/`prebuild`. The `predev` script downloads the curated development set by default.

**Policy:** Curated downloads are pinned to fixed refs. The downloader will not chase remote `main`/`master` updates or refresh cached repos just because upstream moved.

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
- `reactos/reactos` — ReactOS (0.4.16)
- `python/cpython` — Python (v3.12.0)
- `bminor/glibc` — GNU C Library (glibc-2.39)
- `llvm/llvm-project` — LLVM (llvmorg-18.1.0)
- `mrcxlinux/srv03rtm-anika` — Windows Server 2003 source tree (9e4d6bae9ed79e542f0f3ab463d6b00866019ec1)

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
