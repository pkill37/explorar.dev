# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Explorar.dev is a Next.js 16 application for exploring and learning from arbitrary software source code with an interactive VS Code-like interface. It supports both curated repositories (pre-downloaded at build time) and arbitrary GitHub repositories (downloaded on-demand).

**Key Architecture Decisions**:

- **Frontend**: Static Next.js export with no server-side rendering
- **No Backend**: Pure frontend application, no authentication or user data collection
- **Repository Modes**:
  - **Curated Mode**: Static repositories downloaded at build time, served from `/public/repos/`
  - **Arbitrary Mode**: User-selected GitHub repositories downloaded on-demand to IndexedDB

## Essential Commands

### Development

```bash
npm run dev              # Start dev server (port 3000)
```

**Environment Variable Configuration:**

- `.env.development` → Development defaults - loaded when `NODE_ENV=development`
- `.env.production` → Production defaults - loaded when `NODE_ENV=production`
- `.env.local` → Personal overrides (gitignored) - HIGHEST PRIORITY, overrides both above
- `npm run dev` automatically uses `.env.development` (Next.js sets `NODE_ENV=development`)
- `npm run build` automatically uses `.env.production` (Next.js sets `NODE_ENV=production`)

### Build & Test

```bash
# Development
npm run dev              # Start dev server with Turbopack (runs predev script first)
npm run predev           # Downloads Python/CPython repo for local testing

# Building & Deployment
npm run build            # Build static export (runs prebuild script)
npm run prebuild         # Downloads repositories based on --depth flag
npm run clean            # Remove all generated artifacts

# Code Quality
npm run lint             # Type check + ESLint + dependency check
npm run fix              # Auto-fix ESLint, format with Prettier, fix vulnerabilities

# Testing
npm test                 # Run all Playwright tests
npm run test:sanity      # Basic functionality tests
npm run test:performance # Core Web Vitals tests
npm run test:seo         # SEO validation
npm run test:quality     # Accessibility checks (axe-core)
npm run test:score       # Quality score calculation
npm run test:ui          # Interactive test UI
npm run test:report      # View HTML test report

# Testing Notes
# - Tests require the static build: npm run build
# - Tests automatically start an http.server on port 8000
# - Configure test target with: BASE_URL=http://localhost:3000 npm test
```

## Architecture

### High-Level Data Flow

```
User → Route ([owner]/[repo]) → KernelExplorer (Main Container)
         ↓
      RepositoryContext (State Management)
         ↓
    ┌────┴────┬─────────────┬────────────┐
    ↓         ↓             ↓            ↓
 FileTree  CodeEditor  GuidePanel  DataStructuresView
    ↓         ↓             ↓            ↓
  API Layer (github-api.ts)
    ↓
  ┌─┴─────────────────────────────┐
  ↓                               ↓
Static (repo-static.ts)    Dynamic (github-archive.ts)
  ↓                               ↓
/public/repos/*            IndexedDB (repo-storage.ts)
(Curated)                  (Downloaded)
```

### Key Components

**UI Layer** (`src/components/`):

- `KernelExplorer.tsx`: Main container orchestrating all UI elements
- `FileTree.tsx`: Hierarchical file navigation
- `CodeEditorContainer.tsx`: Tab management for open files
- `MonacoCodeEditor.tsx`: Monaco editor wrapper with syntax highlighting
- `GuidePanel.tsx`: Learning guides with markdown parsing
- `DataStructuresView.tsx`: API/data structure browser
- `ActivityBar.tsx`: Navigation sidebar (files, guides, data structures)
- `TabBar.tsx`: Open file tabs
- `StatusBar.tsx`: Bottom status information
- `GitHubRateLimitWrapper.tsx`: Rate limit warnings

**State Management** (`src/contexts/`):

- `RepositoryContext.tsx`: Repository selection, branch management, download state
- `GitHubRateLimitContext.tsx`: Rate limit tracking

**Storage & Data Layer** (`src/lib/`):

- `repo-storage.ts`: IndexedDB wrapper - primary storage for downloaded repos
- `github-archive.ts`: GitHub API integration - downloads tree structure, lazy-loads files
- `repo-static.ts`: Static file reader - serves pre-built curated repos
- `github-api.ts`: File fetching, tree building, API dispatch (routes to static or dynamic)
- `github-cache.ts`: Caching layer with exponential backoff
- `github-retry.ts`: Retry logic and circuit breaker pattern

**Build & Platform** (`src/lib/`):

- `project-guides.tsx`: Configuration for curated repos (paths, guides)
- `monaco-workers.ts`: Monaco editor web worker setup
- `monaco-config.ts`: Editor theme and language configuration
- `platform/`: Platform abstraction (web vs. other environments)

### Repository Modes

**Curated (Static)**:

- Repositories pre-downloaded at build time via `scripts/download-repos.ts`
- Files live in `/public/repos/[owner]/[repo]/[branch]/`
- Configuration in `src/lib/project-guides.tsx`
- No API calls needed after build
- Full offline support
- Examples: Python/CPython, Linux Kernel, LLVM, glibc

**Arbitrary (Dynamic)**:

- User enters any GitHub repository URL
- Tree structure downloaded to IndexedDB via `github-archive.ts`
- File contents lazy-loaded on-demand
- Requires GitHub API access (unauthenticated)
- Rate limits apply (60 req/hr)
- Uses retry logic with exponential backoff

### Storage Strategy

**IndexedDB** (`repo-storage.ts`):

- `files`: Cached file contents
- `metadata`: Repository metadata (branches, sizes)
- `directories`: Directory listings for lazy loading
- `treeStructure`: Complete tree structure for a branch
- Version: 4 (auto-migrates on schema changes)
- Stores both curated and arbitrary repos for offline access

**localStorage**:

- Open tabs (EditorTab[])
- Scroll positions per file
- UI state (expanded folders, active panel)

## Important Design Patterns

### 1. Lazy Loading for Large Repos

Files aren't pre-downloaded. Only the tree structure is fetched. Files load when user opens them or navigates directories. This keeps memory/storage usage low.

- `hasTreeStructure()`: Check if tree is cached
- `downloadDirectoryContents()`: Download directory's immediate children only
- `fetchFileContent()`: Fetch single file on-demand

### 2. Repository Mode Dispatch

`github-api.ts` dispatches calls to either static or dynamic sources:

```typescript
// buildFileTree() checks isCuratedRepo() first
// If curated: calls getTreeStructureFromStatic()
// If arbitrary: calls downloadBranch() → IndexedDB
```

### 3. Deferred Metadata Updates

During bulk downloads, metadata updates are debounced (1000ms) to prevent IndexedDB transaction conflicts. See `metadataUpdateQueue` in `repo-storage.ts`.

### 4. Guide System

Markdown guides for curated repos are loaded via `guide-loader.tsx` which parses frontmatter (YAML) and markdown to create chapter-based learning paths.

## Common Development Tasks

### Adding a Curated Repository

1. Update `src/lib/project-guides.tsx` with repo config
2. Add download script or manually place files in `public/repos/[owner]/[repo]/[branch]/`
3. Add markdown guides in `src/lib/guides/[repo-name].md`
4. Build: `npm run build`

### Debugging File Access

Check which source is being used:

```typescript
import { getRepositoryMode } from '@/lib/repo-static';
const mode = getRepositoryMode(owner, repo); // 'curated' or 'arbitrary'
```

### Inspecting IndexedDB

In browser DevTools:

1. Application → IndexedDB → explorar-repo-storage
2. Check `files`, `metadata`, `treeStructure` stores

### Handling GitHub Rate Limits

- Unauthenticated: 60 requests/hour
- Rate limit is tracked via `GitHubRateLimitContext`
- When exceeded, `RateLimitScreen.tsx` is shown

### Testing Changes

For routing/UI changes:

```bash
npm run dev
# Open http://localhost:3000/python/cpython
```

For build/static export changes:

```bash
npm run build
npm run test:sanity
```

## TypeScript & Strict Mode

- Strict mode enabled in `tsconfig.json`
- All components are `'use client'` (client-side rendering)
- Frontend types: `src/types/index.ts` (FileNode, EditorTab, GitHubApiResponse)
- Path aliases:
  - `@/*` → `src/*` (frontend code)

## Build Output

- Static export to `out/` directory
- No server-side rendering (SSR)
- Works with any static host (Netlify, Vercel, S3, etc.)
- Curated repos must be in `out/repos/` after build

## Environment Variables

### Frontend (Next.js)

- `NEXT_PUBLIC_SITE_URL`: Site URL for metadata (default: `https://explorar.dev`)
- `NEXT_PUBLIC_GUIDES_API_URL`: API URL for AI-generated guides (optional)
- `NEXT_PUBLIC_GUIDES_API_KEY`: API key for guides service (optional)

## Key Files to Know

| File                                 | Purpose                                    |
| ------------------------------------ | ------------------------------------------ |
| `src/app/[owner]/[repo]/page.tsx`    | Dynamic route renderer                     |
| `src/components/KernelExplorer.tsx`  | Main UI orchestrator                       |
| `src/contexts/RepositoryContext.tsx` | State management                           |
| `src/lib/github-api.ts`              | API dispatch & tree building               |
| `src/lib/github-archive.ts`          | GitHub download logic                      |
| `src/lib/repo-storage.ts`            | IndexedDB interface                        |
| `src/lib/repo-static.ts`             | Static file serving                        |
| `src/lib/project-guides.tsx`         | Curated repo config                        |
| `next.config.ts`                     | Build config (static export, Monaco setup) |
| `playwright.config.ts`               | Test configuration                         |
| `CLAUDE.md`                          | Project documentation (this file)          |
