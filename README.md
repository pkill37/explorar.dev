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

> 💡 **Tip**: Each repository uses smart downloading to fetch only essential files, making exploration fast and efficient!

## ✨ Features

- 📁 **Interactive File Browser**: Navigate any software source tree with VS Code-like interface
- 💻 **Monaco Code Editor**: Full-featured editor with syntax highlighting for 100+ languages
- 📚 **Guided Learning**: Chapter-based learning paths with interactive quizzes
- 🗂️ **Data Structures View**: Browse and explore kernel data structures and APIs
- 🔗 **GitHub Integration**: Browse any GitHub repository's source code instantly
- 📖 **Kernel Study Mode**: Annotated code with kernel concepts and educational markers
- ⚡ **Smart Downloads**: Selective downloading of essential files for large repositories
- 💾 **Local Storage**: IndexedDB-based persistent storage with offline access
- 🔄 **Smart Caching**: IndexedDB caching with exponential backoff retry logic
- 🛡️ **Fault Tolerance**: Circuit breaker pattern for resilient API calls
- 🎯 **Zero Setup**: No installation required - works entirely in your browser

## 🚀 Getting Started

### 🌐 Using the Live Site

Simply visit [explorar.dev](https://explorar.dev) and:

1. **Quick Start**: Click any of the pre-configured repositories (Linux, Python, LLVM, glibc)
2. **Custom Repository**: Enter any GitHub repository URL (e.g., `github.com/owner/repo`)

### 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The wizard will guide you through selecting or downloading a repository to explore.

### 🏗️ Build

```bash
npm run build
```

## 📁 Project Structure

```
src/
├── app/
│   ├── [owner]/[repo]/        # Dynamic repository routes
│   ├── layout.tsx             # Root layout with metadata
│   └── page.tsx               # Main wizard page
├── components/
│   ├── KernelExplorer.tsx     # Main repository explorer
│   ├── FileTree.tsx           # File tree navigation
│   ├── CodeEditorContainer.tsx # Editor with tabs
│   ├── MonacoCodeEditor.tsx   # Monaco editor wrapper
│   ├── GuidePanel.tsx         # Learning guides
│   ├── QuickStarts.tsx        # Repository quick starts
│   └── ...                    # Other UI components
├── contexts/
│   └── RepositoryContext.tsx  # Repository state management
├── hooks/
├── lib/
│   ├── repo-storage.ts        # IndexedDB storage management
│   ├── github-archive.ts      # Repository downloading
│   ├── selective-download.ts  # Smart downloading for large repos
│   ├── github-api.ts          # GitHub API integration
│   ├── github-cache.ts        # Caching layer
│   └── ...                    # Other utilities
└── types/
    └── index.ts               # TypeScript definitions
```

## 🛠️ Technologies

- **[Next.js 16](https://nextjs.org/)**: React framework with App Router
- **[React 19](https://react.dev/)**: Latest React with concurrent features
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)**: VS Code editor component
- **[TypeScript](https://www.typescriptlang.org/)**: Full type safety
- **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)**: Browser database for persistent storage (works in all modern browsers)
- **[JSZip](https://stuk.github.io/jszip/)**: Client-side zip file handling

## 💾 Storage & Download System

### Smart Repository Downloads

- **Selective Downloads**: Large repositories (Linux kernel, LLVM) download only essential directories
- **Lazy Loading**: Branches are downloaded only when requested
- **Offline Access**: Downloaded repositories work completely offline

### Local Storage Options

- **IndexedDB Storage**: Persistent browser storage that survives page refreshes (works in all modern browsers including Firefox)
- **Storage Management**: View usage, manage repositories, clear storage

## ⚙️ Environment Variables

### Production Configuration

The production build is configured with the following defaults in `next.config.ts`:

- `NEXT_PUBLIC_WORKER_API_URL`: Cloudflare Worker API URL
  - Production: `https://shared-data-store-api.fabiu-maia.workers.dev`

### Optional Environment Variables

- `NEXT_PUBLIC_SITE_URL`: Site URL for metadata (default: `https://explorar.dev`)
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`: GitHub OAuth App Client ID (required for authentication)

## 🔧 Advanced Features

### 🗄️ Caching System

The application uses a sophisticated caching system with:

- **IndexedDB** as primary storage with **localStorage** fallback
- Automatic cache size management (50MB limit)
- Cache versioning and migration support

### 🔄 Retry Logic

Built-in fault tolerance with:

- Exponential backoff retry mechanism
- Configurable retry strategies
- Circuit breaker pattern to prevent cascading failures
- Automatic recovery after service restoration

## 🤝 Contributing

This is a private project, but contributions and feedback are welcome!

## 📄 License

Private project.

## 🔗 Links

- 🌐 **Website**: [explorar.dev](https://explorar.dev)
- 🔓 **GitHub**: [github.com/pkill37/explorar.dev](https://github.com/pkill37/explorar.dev)
- 💬 **Discord**: [discord.gg/fuXYz44tSs](https://discord.gg/fuXYz44tSs)
- 📱 **Telegram**: [t.me/explorardev](https://t.me/explorardev)
- 🧠 **BrainSpeed.ai**: [AI-powered development tools](https://brainspeed.ai)
- 🔄 **Reverser.dev**: [Reverse engineering platform](https://reverser.dev)
