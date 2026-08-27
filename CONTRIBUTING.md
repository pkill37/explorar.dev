# Contributing

Explorar is a pure frontend Next.js app for browsing large source repositories through curated
markdown guides, indexed search, cross-references, diagrams, and knowledge checks. Most guide work
should happen in `docs/`.

## Local Setup

```bash
npm install
npm run dev
```

The app opens at <http://localhost:3000>. `npm run dev` runs `predev`, which downloads the main
curated development repositories on first use.

Useful commands:

```bash
npm run guides:validate  # validate docs/ guide markdown and repo references
npm run guides:format    # format guide markdown and this file
npm run lint             # types, eslint, prettier, markdownlint, depcheck
npm run build            # static export to out/
npm test                 # Playwright tests; run after a build or with BASE_URL
```

Configuration lives in `.env.development`, `.env.production`, `.env.example`, and optional
uncommitted `.env.local` overrides. All app-facing variables are `NEXT_PUBLIC_`.

## Architecture Notes

There is no backend, server state, or authentication. The browser loads:

- the static Next.js shell from `out/`
- curated repository files from the local staged corpus in development
- production curated files from the configured public R2/custom-domain origin
- arbitrary user-entered repositories through the unauthenticated GitHub API

Curated repos are pinned in `src/lib/curated-repos.ts` and downloaded under
`repos/<owner>/<repo>/<revision>/`. The browser serves local corpus files through generated
`public/repos` staging in development.

## Guide Workflow

To edit an existing guide:

1. Open the matching markdown file in `docs/`.
2. Keep repository paths relative to that repository root.
3. Prefer full paths like `kernel/fork.c` over bare filenames like `fork.c`.
4. Link important files with normal markdown links.
5. Run `npm run guides:validate`.

To add a new guide, start from `docs/_template.md` and save it as:

```text
docs/<owner>_<repo>.md
```

If the repository is not already listed in `src/lib/curated-repos.ts`, add the curated repository
entry too. That is the normal TypeScript touchpoint for a brand-new repository.

## Guide Format

Each guide starts with document frontmatter:

```yaml
---
curatedRepoId: repo-config-id
owner: owner
repo: repo
revision: pinned-ref-or-sha
guideId: owner-repo-guide
name: Human Name
description: Short learning promise
defaultOpenIds:
  - ch1
---
```

Each chapter is separated by section frontmatter:

```yaml
---
id: ch1
title: Chapter 1 - Mental Model
difficulty: beginner
learningGoals:
  - Explain the subsystem in one sentence.
trace:
  - path: path/to/file.c:symbol_name
    description: Start here
    type: source
questions:
  - prompt: What owns this state?
    answer: The central subsystem structure owns it.
fileRecommendations:
  readingOrder:
    - path: path/to/file.c:symbol_name
      description: Why this file matters
      type: source
---
```

Navigation syntax:

- `path/to/file.c` opens a file.
- `path/to/file.c:123` opens near a line.
- `path/to/file.c:symbol_name` opens a file and searches for a symbol.
- `path/to/doc.rst#heading` keeps the documentation anchor.
- `man:futex(2)` or `futex(2)` opens a manual page when available.

Chapter diagrams use `chapter-graph` fenced blocks:

````text
```chapter-graph
path/a.c -> path/b.c : calls into
path/b.c -> include/a.h : uses API from
```
````

Every edge must use `source -> target : label`.

## Troubleshooting

If repository files do not load, download the relevant curated corpus:

```bash
tsx scripts/download-repos.ts --only=torvalds/linux --depth=1
```

Use `tsx scripts/download-repos.ts --list` to see available curated repositories. Restart the dev
server after changing environment variables.
