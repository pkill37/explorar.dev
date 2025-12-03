# Linux Kernel Explorer

A standalone Next.js 16 application for exploring the Linux kernel source code with an interactive, VS Code-like interface.

## Features

- **Interactive File Browser**: Navigate the Linux kernel source tree
- **Code Editor**: Monaco Editor with syntax highlighting for C, assembly, and more
- **Guided Learning**: Chapter-based learning paths with quizzes
- **Data Structures View**: Browse and explore kernel data structures
- **GitHub Integration**: Browse any GitHub repository's source code
- **Kernel Study Mode**: Annotated code with kernel concepts and markers

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will automatically redirect to `/linux-kernel-explorer`.

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Project Structure

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
│   ├── kernel-markers.ts      # Kernel code markers
│   └── kernel-suggestions.ts # Learning suggestions
└── types/
    └── index.ts               # TypeScript definitions
```

## Technologies

- **Next.js 16**: React framework
- **React 19**: UI library
- **Monaco Editor**: VS Code editor component
- **TypeScript**: Type safety
- **IndexedDB**: Client-side caching

## Environment Variables

Optional environment variables:

- `NEXT_PUBLIC_SITE_URL`: Site URL for metadata (default: `https://explorar.dev`)

## License

Private project.
