# 🚀 Explorar.dev

A standalone [Next.js 16](https://nextjs.org/) application for exploring and learning from arbitrary software source code with an interactive, VS Code-like interface. Perfect for studying the Linux kernel, Python CPython, glibc, LLVM, and any GitHub repository.

🌐 **Live Site**: [explorar.dev](https://explorar.dev)  
🔓 **GitHub**: [pkill37/explorar.dev](https://github.com/pkill37/explorar.dev)

## ✨ Features

- 📁 **Interactive File Browser**: Navigate any software source tree
- 💻 **Code Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) with syntax highlighting for C, assembly, and more
- 📚 **Guided Learning**: Chapter-based learning paths with quizzes
- 🗂️ **Data Structures View**: Browse and explore kernel data structures
- 🔗 **GitHub Integration**: Browse any GitHub repository's source code
- 📖 **Kernel Study Mode**: Annotated code with kernel concepts and markers
- 🔄 **Smart Caching**: IndexedDB caching with exponential backoff retry logic
- 🛡️ **Fault Tolerance**: Circuit breaker pattern for resilient API calls

## 🚀 Getting Started

### 📦 Installation

```bash
npm install
```

### 🛠️ Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will automatically redirect to `/linux-kernel-explorer` (or navigate to any repository path like `/torvalds/linux`).

### 🏗️ Build

```bash
npm run build
```

### 🚢 Start Production Server

```bash
npm start
```

## 📁 Project Structure

```
src/
├── app/
│   ├── linux-kernel-explorer/
│   │   ├── page.tsx          # Main explorer page
│   │   ├── layout.tsx         # Page metadata
│   │   └── vscode.css         # VS Code theme styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page (redirects)
├── components/
│   ├── ChapterQuiz.tsx        # Quiz component
│   ├── CodeEditorContainer.tsx # Editor wrapper
│   ├── DataStructuresView.tsx # Data structures browser
│   ├── FileTree.tsx           # File tree component
│   ├── GuidePanel.tsx         # Learning guide panel
│   ├── KernelStudyEditor.tsx  # Annotated kernel editor
│   ├── MonacoCodeEditor.tsx   # Standard code editor
│   └── TabBar.tsx             # Tab bar component
├── hooks/
│   └── useKernelProgress.ts   # Progress tracking hook
├── lib/
│   ├── cross-reference.ts     # Code cross-referencing
│   ├── github-api.ts          # GitHub API client
│   ├── github-cache.ts        # IndexedDB caching
│   ├── github-retry.ts        # Retry logic with exponential backoff
│   ├── github-debug.ts        # Debugging and logging utilities
│   ├── kernel-markers.ts      # Kernel code markers
│   └── kernel-suggestions.ts # Learning suggestions
└── types/
    └── index.ts               # TypeScript definitions
```

## 🛠️ Technologies

- **[Next.js 16](https://nextjs.org/)**: React framework
- **[React 19](https://react.dev/)**: UI library
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)**: VS Code editor component
- **[TypeScript](https://www.typescriptlang.org/)**: Type safety
- **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)**: Client-side caching

## ⚙️ Environment Variables

Optional environment variables:

- `NEXT_PUBLIC_SITE_URL`: Site URL for metadata (default: `https://explorar.dev`)

## 🔧 Advanced Features

### 🗄️ Caching System

The application uses a sophisticated caching system with:

- **IndexedDB** as primary storage with **localStorage** fallback
- Automatic cache size management (50MB limit)
- Cache versioning and migration support
- Debug mode for cache inspection

### 🔄 Retry Logic

Built-in fault tolerance with:

- Exponential backoff retry mechanism
- Configurable retry strategies
- Circuit breaker pattern to prevent cascading failures
- Automatic recovery after service restoration

### 🐛 Debugging

Enable debug mode for detailed logging:

- Set `localStorage.setItem('github_api_debug', 'true')` for API debugging
- Set `localStorage.setItem('github_cache_debug', 'true')` for cache debugging
- Performance metrics and error tracking

## 🤝 Contributing

This is a private project, but contributions and feedback are welcome!

## 📄 License

Private project.

## 🔗 Links

- 🌐 **Website**: [explorar.dev](https://explorar.dev)
- 🔓 **GitHub**: [github.com/pkill37/explorar.dev](https://github.com/pkill37/explorar.dev)
- 💬 **Discord**: [Join our community](https://discord.gg/fuXYz44tSs)
- 🧠 **BrainSpeed.ai**: [AI-powered development tools](https://brainspeed.ai)
- 🔄 **Reverser.dev**: [Reverse engineering platform](https://reverser.dev)
