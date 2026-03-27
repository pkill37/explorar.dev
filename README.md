# 🚀 Explorar.dev

A standalone [Next.js 16](https://nextjs.org/) application for exploring and learning from arbitrary software source code with an interactive, VS Code-like interface. Perfect for studying the Linux kernel, Python CPython, glibc, LLVM, and any GitHub repository.

🌐 **Live Site**: [explorar.dev](https://explorar.dev)
🔓 **GitHub**: [pkill37/explorar.dev](https://github.com/pkill37/explorar.dev)

## 🎯 Live Examples

Explore these popular repositories instantly:

| Repository          | Description                       | Live Demo                                                                |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| **🐧 Linux Kernel** | Core operating system kernel      | [explorar.dev/torvalds/linux](https://explorar.dev/torvalds/linux)       |
| **🐍 CPython**      | Python interpreter implementation | [explorar.dev/python/cpython](https://explorar.dev/python/cpython)       |
| **🔧 LLVM**         | Compiler infrastructure project   | [explorar.dev/llvm/llvm-project](https://explorar.dev/llvm/llvm-project) |
| **📚 glibc**        | GNU C Library implementation      | [explorar.dev/bminor/glibc](https://explorar.dev/bminor/glibc)           |

> 💡 **Tip**: Curated repositories are pre-downloaded at build time — exploration is instant with no API calls needed!

## ✨ Features

- 📁 **Interactive File Browser**: Navigate any software source tree with VS Code-like interface
- 💻 **Monaco Code Editor**: Full-featured editor with syntax highlighting for 100+ languages
- 📚 **Guided Learning**: Chapter-based learning paths for curated repositories
- 🗂️ **Data Structures View**: Browse and explore kernel data structures and APIs
- ⚡ **Static & Fast**: Curated repos are pre-built; no server needed
- 💾 **Local Storage**: IndexedDB-based persistent storage with offline access
- 🎯 **Zero Setup**: No installation required — works entirely in your browser

## 🚀 Getting Started

### 🌐 Using the Live Site

Simply visit [explorar.dev](https://explorar.dev) and click any of the pre-configured repositories (Linux, Python, LLVM, glibc).

### 🛠️ Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:3000. The `predev` script automatically downloads the CPython repository for local testing.

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete development instructions.**

## 📁 Project Structure

```
explorar.dev/
├── src/                         # Frontend (Next.js)
│   ├── app/
│   │   ├── [owner]/[repo]/     # Dynamic repository routes
│   │   ├── layout.tsx          # Root layout with metadata
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── KernelExplorer.tsx  # Main repository explorer
│   │   ├── FileTree.tsx        # File tree navigation
│   │   ├── CodeEditorContainer.tsx # Editor with tabs
│   │   ├── MonacoCodeEditor.tsx # Monaco editor wrapper
│   │   ├── GuidePanel.tsx      # Learning guides
│   │   └── ...                 # Other UI components
│   ├── contexts/
│   │   └── RepositoryContext.tsx # Repository state management
│   ├── lib/
│   │   ├── repo-storage.ts     # IndexedDB storage
│   │   ├── github-archive.ts   # Repository downloading
│   │   ├── github-api.ts       # GitHub API integration
│   │   ├── repo-static.ts      # Static file serving
│   │   └── ...                 # Other utilities
│   └── types/
│       └── index.ts            # TypeScript type definitions
├── docs/                        # Markdown guides for curated repos
├── public/
│   └── repos/                  # Pre-downloaded curated repos (build artifact)
└── scripts/
    └── download-repos.ts       # Build-time repo downloader
```

## 🛠️ Technologies

- **[Next.js 16](https://nextjs.org/)**: React framework with App Router (static export)
- **[React 19](https://react.dev/)**: Latest React with concurrent features
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)**: VS Code editor component
- **[TypeScript](https://www.typescriptlang.org/)**: Full type safety
- **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)**: Browser database for persistent storage
- **[JSZip](https://stuk.github.io/jszip/)**: Client-side zip file handling

## 💾 Storage & Download System

### Curated Repositories (Static)

Pre-downloaded at build time via `scripts/download-repos.ts`. Files are served from `/public/repos/` — no API calls required, full offline support.

### Arbitrary Repositories (Dynamic)

User-entered GitHub repositories are downloaded on-demand into IndexedDB. Files are lazy-loaded when opened. Requires GitHub API access (60 req/hr unauthenticated).

## 📚 Documentation

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Complete development guide
- **[CLAUDE.md](./CLAUDE.md)** - Architecture and codebase guide for Claude Code

## 🤝 Contributing

Contributions and feedback are welcome!

## 📄 License

Private project.

## 🔗 Links

- 🌐 **Website**: [explorar.dev](https://explorar.dev)
- 🔓 **GitHub**: [github.com/pkill37/explorar.dev](https://github.com/pkill37/explorar.dev)
- 💬 **Discord**: [discord.gg/fuXYz44tSs](https://discord.gg/fuXYz44tSs)
- 📱 **Telegram**: [t.me/explorardev](https://t.me/explorardev)
- 🧠 **BrainSpeed.ai**: [AI-powered development tools](https://brainspeed.ai)
- 🔄 **Reverser.dev**: [Reverse engineering platform](https://reverser.dev)
