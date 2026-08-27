# [Explorar.dev](https://explorar.dev)

[![](https://dcbadge.limes.pink/api/server/fuXYz44tSs)](https://discord.gg/fuXYz44tSs)

[![Featured on Hacker News](https://hackerbadge.now.sh/api?id=46066280)](https://news.ycombinator.com/item?id=46066280)

Explorar is a Next.js web application with a VS Code-like interface for browsing large source
repositories through curated guides, indexed search, cross-references, diagrams, and knowledge
checks.

Build your own local copy of the Explorar application, which will download all the git tags to your filesystem (get a coffee, this may take some time), and subsequently build the "shell" web application that works entirely offline and instantly.

```bash
npm install
npm run dev      # starts at localhost:3000
```

```
npm run guides:validate # validate markdown guides and repo references
npm run lint     # tsc + eslint + prettier + markdownlint + depcheck
npm run build    # static export to out/ for a static host
npm run deploy   # production deploy: R2 sync of repo corpus
npm test         # Playwright tests (requires built output)
```

Guide contributions are markdown-centered: edit or add files in `docs/`, start new guides from
`docs/_template.md`, and see `CONTRIBUTING.md` for the full workflow.

Cloudflare Pages builds set `CF_PAGES=1`, so `npm run build` skips the expensive corpus and
man-page generation phases and exports only the static shell. The shell loads repositories, indexes,
and manual pages from the configured public R2 origin. Set `EXPLORAR_SKIP_CORPUS_BUILD=0` to force a
full local corpus build.

Online you can visit **[https://explorar.dev](https://explorar.dev)** for free. Repository source files are loaded on demand from a public bucket-backed origin, with R2 as the default source.

## Roadmap

Explorar should stay a guide-first source browser. The goal is to improve guides, search, graph
views, and editor navigation with structured indexing and language-aware retrieval, not to turn the
product into a chat-first tool.

The long-term architecture is:

```text
Repository
  ↓
Config + Ignore Rules
  ↓
Language Detection
  ↓
Per-Language Indexers
  ↓
Unified Knowledge Base
  ↓
Retrieval Layer
  ↓
Monaco + Guides + Graph UI
```

For public web deployment, expensive analysis should happen in offline index builders. The browser
client and read-only query APIs should consume prebuilt source snapshots and semantic artifacts
rather than spawning per-user language-server sessions.

### Milestone 0: Index Foundation

- [x] Generate a SQLite code index for curated repository snapshots.
- [x] Store files, symbols, references, file edges, guide links, concept links, and search tables in
      the index schema.
- [x] Load and cache `code-index.sqlite` in the browser for static deployments.
- [x] Keep heuristic navigation available as a fallback when an index is missing or incomplete.
- [ ] Add `explorar.toml` for repo-specific indexing config.
- [ ] Add `.explorarignore` for excluded paths.
- [ ] Add a local `.explorar/` cache layout for generated index artifacts.

### Milestone 1: Editor Backend Abstraction

- [x] Add a live editor language backend interface keyed by `languageId`.
- [x] Wire Monaco definition, reference, and hover flows through the indexed backend before falling
      back to heuristics.
- [x] Provide indexed symbol, file, reference, graph-neighbor, guide-link, and concept query helpers.
- [ ] Share one backend contract between offline indexing and live editor queries.
- [ ] Implement backend-provided diagnostics and document symbols.

### Milestone 2: C / C++ Semantic Navigation

- [ ] Integrate `clangd` for C/C++ indexing and editor queries.
- [ ] Replace heuristic-only C/C++ navigation where `clangd` data is available.
- [ ] Support parser-backed hover, definitions, references, diagnostics, type/member traversal, and
      include chains.
- [ ] Validate on Linux, XNU, seL4, and CPython native runtime code.

### Milestone 3: Python Semantic Navigation

- [ ] Integrate `pyright` or `basedpyright` for Python indexing and editor queries.
- [ ] Resolve Python symbols across stdlib, tests, tools, and scripts.
- [ ] Support Python hover, definitions, references, and diagnostics through the backend path.

### Milestone 4: Graph Retrieval And Concepts

- [x] Persist basic file edges, guide links, and concept links in the index.
- [ ] Add callers/callees, include/import expansion, and related-files panels.
- [ ] Resolve guide mentions to multiple symbol candidates instead of only file paths.
- [ ] Add concept views that group docs, tests, headers, and implementations.
- [ ] Add scoped search tabs for files, symbols, and references.

### Milestone 5: CPython Mixed Traversal

- [ ] Connect `Include/*.h`, `Objects/*.c`, `Python/*.c`, `Lib/*.py`, `Lib/test/*.py`, `Tools/*.py`,
      and `docs/python_cpython.md` in one retrieval model.
- [ ] Make `PyObject`, `PyTypeObject`, and `PyDictObject` resolve correctly.
- [ ] Make a concept like `dict` jump across docs, tests, headers, implementations, constructors,
      and guide chapters.
- [ ] Prove the same retrieval model on Linux and XNU kernel code.

### Milestone 6: Optional Semantic Retrieval

- [ ] Add embeddings only after exact symbol and graph retrieval are strong.
- [ ] Keep semantic search additive; exact structural lookup remains the primary retrieval path.

### UX Backlog

- [ ] Deep-linkable file, line, and symbol URLs.
- [ ] File outline panel.
- [ ] Per-file metadata strip with language, size, source, and related guide sections.
- [x] Persist open tabs and workspace state locally.
- [ ] Side-by-side file compare for two refs or branches.
- [ ] Guide-aware navigation polish such as opening all files in a chapter.
- [ ] Subsystem map / architecture view.
- [ ] Blame and history overlays.
- [ ] Dependency graph explorer.
- [ ] API surface explorer.
- [ ] Version-aware guides.
- [ ] Ownership or maintainer overlays.
- [ ] Build-target awareness.
- [ ] Automatic interesting-files ranking.
