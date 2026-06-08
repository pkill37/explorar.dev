# [Explorar.dev](https://explorar.dev)

[![](https://dcbadge.limes.pink/api/server/fuXYz44tSs)](https://discord.gg/fuXYz44tSs)

[![Featured on Hacker News](https://hackerbadge.now.sh/api?id=46066280)](https://news.ycombinator.com/item?id=46066280)

Explorar is a Next.js web application with a VS Code-like interface that takes in source code files and offers guided exploration, notes, quizzes, exercises, etc.

Build your own local copy of the Explorar application, which will download all the git tags to your filesystem (get a coffee, this may take some time), and subsequently build the "shell" web application that works entirely offline and instantly.

```bash
npm install
npm run dev      # starts at localhost:3000, downloads CPython automatically
npm run lint     # tsc + eslint + prettier + depcheck
npm run build    # static export to out/ for Cloudflare Pages deployment
npm run deploy   # production deploy: R2 sync of repo corpus
npm test         # Playwright tests (requires built output)
```

Online you can visit **[https://explorar.dev](https://explorar.dev)** for free where the Next.js application is deployed by CI from the main branch. Repository source files are loaded on demand from a public bucket-backed origin, with R2 as the default source.

## Roadmap

### Quick Wins

- [ ] Deep-linkable file/line/symbol URLs. High value, low risk, immediately shareable.
- [ ] File outline panel. Fast improvement to navigation with existing parsing work.
- [ ] Better search UX. Path/content/symbol tabs, scoped search by folder or guide chapter.
- [ ] Per-file metadata strip. Last modified source, language, size, related guide sections.
- [ ] Saved tabs/workspace state. Restore open files, scroll, active guide chapter.
- [ ] Side-by-side file compare for two refs or branches. Useful even before full semantic intelligence.
- [ ] Guide-aware navigation polish. “Open all files in this chapter”, “next recommended file”, “related
      docs”.

### Core Differentiators

- [ ] Symbol cross-references. Definition, references, callers, callees, include chain. This is the
      biggest step toward an AOSP-class browser.
- [ ] Indexed global search over curated repos. Real symbol/path/text indexing rather than ad hoc fetch/
      search.
- [ ] Subsystem map / architecture view. An opinionated entry point into giant codebases instead of raw
      trees only.
- [ ] Blame/history overlays. Make the browser useful for understanding change, not just reading
      snapshots.
- [ ] Dependency graph explorer. Include/import relationships and reverse dependencies, especially
      strong for kernels, libc, LLVM.
- [ ] API surface explorer. Separate externally interesting interfaces from internal implementation
      noise.
- [ ] Version-aware guides. Pin guides to repo refs and show drift when the user switches versions.

### Hard But Worth It

- [ ] Semantic navigation for C/C++. Real parser-backed “go to definition”, “find implementations”, type/member xrefs.
- [ ] Ownership/maintainer overlays. CODEOWNERS-style routing, likely experts, review boundaries.
- [ ] Build-target awareness. “Which module/library/target pulls this file in?”
- [ ] Release-to-release path history. What changed in this subsystem between tags.
- [ ] Review/study annotations. Shared annotated links, notes on lines, saved reading trails.
- [ ] Automatic “interesting files” ranking. For enormous repos, compute the best entry points by subsystem or concept.

### Suggested Order

1. Deep links, outline, scoped search, workspace restore.
2. Indexed search and guide-aware navigation polish.
3. Symbol xrefs for curated repos.
4. Graph/dependency and subsystem views.
5. Blame/history and version-aware guides.
6. Parser-backed semantic nav and build-awareness.

The first layer improves usability immediately without major infrastructure. The second layer builds the retrieval/indexing foundation. The third and fourth layers are what make it feel like a real source browser rather than a static viewer. The last layer is expensive and only worth doing once the navigation/search model is already solid.
