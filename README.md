# Explorar.dev

Explore codebases with an interactive, VS Code-like interface.

Open-source curated repos (Linux, LLVM, glibc, XNU, etc) are pre-built for instant and offline access.

**[explorar.dev](https://explorar.dev)** · [GitHub](https://github.com/pkill37/explorar.dev) · [Discord](https://discord.gg/fuXYz44tSs)

## Development

```bash
npm install
npm run dev      # starts at localhost:3000, downloads CPython automatically
npm run build    # static export to out/
npm run lint     # tsc + eslint + prettier + depcheck
npm test         # Playwright tests (requires built output)
```

See [CLAUDE.md](./CLAUDE.md) for architecture details.
