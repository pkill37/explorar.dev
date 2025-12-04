'use client';
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import FileTree from '@/components/FileTree';
import TabBar from '@/components/TabBar';
import CodeEditorContainer from '@/components/CodeEditorContainer';
import GuidePanel from '@/components/GuidePanel';
import ChapterQuiz, { QuizQuestion } from '@/components/ChapterQuiz';
import DataStructuresView from '@/components/DataStructuresView';
import ActivityBar from '@/components/ActivityBar';
import StatusBar from '@/components/StatusBar';
import CommandPalette from '@/components/CommandPalette';
import { EditorTab, KernelSuggestion } from '@/types';
import {
  buildFileTree,
  fetchFileContent,
  getCurrentRepoLabel,
  getCurrentBranch,
  setGitHubRepoWithDefaultBranch,
} from '@/lib/github-api';
import { getAllSuggestionsForFile, getFundamentalConcepts } from '@/lib/kernel-suggestions';
import { useKernelProgress } from '@/hooks/useKernelProgress';
import '@/app/linux-kernel-explorer/vscode.css';

// Helper functions for safe localStorage operations
const saveToLocalStorage = (key: string, value: unknown) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

const loadFromLocalStorage = (key: string, defaultValue: unknown): unknown => {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
  }
  return defaultValue;
};

// Helper component to render file recommendations with distinction between docs and source
const FileRecommendations = ({
  docs,
  source,
  onFileClick,
}: {
  docs: Array<{ path: string; description?: string }>;
  source: Array<{ path: string; description?: string }>;
  onFileClick: (path: string) => void;
}) => (
  <div style={{ marginTop: '16px', marginBottom: '16px' }}>
    {docs.length > 0 && (
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--vscode-textLink-foreground)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          📚 Documentation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {docs.map((file) => (
            <button
              key={file.path}
              onClick={() => onFileClick(file.path)}
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '12px',
                background: 'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))',
                border: '1px solid var(--vscode-textBlockQuote-border, rgba(100, 150, 200, 0.2))',
                borderRadius: '4px',
                color: 'var(--vscode-textLink-foreground, #4a9eff)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.2))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))';
              }}
            >
              <div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{file.path}</div>
              {file.description && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--vscode-descriptionForeground, #999)',
                    marginTop: '2px',
                  }}
                >
                  {file.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    )}
    {source.length > 0 && (
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--vscode-textPreformat-foreground, #d4d4d4)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          💻 Source Code
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {source.map((file) => (
            <button
              key={file.path}
              onClick={() => onFileClick(file.path)}
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '12px',
                background: 'var(--vscode-editor-background, #1e1e1e)',
                border: '1px solid var(--vscode-panel-border, #3e3e3e)',
                borderRadius: '4px',
                color: 'var(--vscode-foreground, #d4d4d4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';
                e.currentTarget.style.borderColor = 'var(--vscode-focusBorder, #007acc)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--vscode-editor-background, #1e1e1e)';
                e.currentTarget.style.borderColor = 'var(--vscode-panel-border, #3e3e3e)';
              }}
            >
              <div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{file.path}</div>
              {file.description && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--vscode-descriptionForeground, #999)',
                    marginTop: '2px',
                  }}
                >
                  {file.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

interface KernelExplorerProps {
  owner?: string;
  repo?: string;
  branch?: string;
}

export default function KernelExplorer({ owner, repo, branch }: KernelExplorerProps) {
  const githubUrlRef = useRef<HTMLInputElement>(null);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [directoryExpandRequest, setDirectoryExpandRequest] = useState<{
    path: string;
    id: number;
  } | null>(null);
  // Initialize with consistent values for SSR (will be updated after hydration)
  const [suggestions, setSuggestions] = useState<KernelSuggestion[]>([]);
  const [repoLabel, setRepoLabel] = useState<string>('torvalds/linux');
  const [treeRefreshKey] = useState<string>('init');

  // Kernel version state
  const [selectedVersion, setSelectedVersion] = useState<string>(branch || 'master');

  // Progress tracking for chapters
  const chapterIds = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9'];
  const { progress, markQuizComplete, getChapterProgress, resetProgress } =
    useKernelProgress(chapterIds);

  // Panel width state - start with defaults to avoid hydration mismatch
  const [sidebarWidth, setSidebarWidth] = useState<number>(220);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Sidebar tab state
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'data-structures'>(
    'explorer'
  );

  // Command palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Editor state for status bar
  const [editorLine, setEditorLine] = useState<number>(1);
  const [editorColumn, setEditorColumn] = useState<number>(1);
  const [editorLanguage, setEditorLanguage] = useState<string>('');
  const [editorLineCount, setEditorLineCount] = useState<number>(0);
  const [editorFileSize, setEditorFileSize] = useState<string>('');

  // Mobile panel state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isRightPanelOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Initial loading state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkViewport = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    checkViewport();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkViewport);
      return () => window.removeEventListener('resize', checkViewport);
    }
  }, []);

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + P for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Escape to close command palette
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  // Initial loading animation - 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize repository from URL params or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      // Priority: URL params > localStorage
      if (owner && repo) {
        // Initialize from URL params - auto-detect default branch if not specified
        setGitHubRepoWithDefaultBranch(owner, repo, branch || 'master').then(() => {
          setRepoLabel(`${owner}/${repo}`);
          const actualBranch = getCurrentBranch();
          setSelectedVersion(branch || actualBranch || 'master');
        });

        // Save to localStorage for persistence
        const githubUrl = `github.com/${owner}/${repo}`;
        localStorage.setItem('kernel-explorer-github-url', githubUrl);
        if (branch) {
          localStorage.setItem('kernel-explorer-selected-version', branch);
        }
      } else {
        // Fallback to localStorage (for backward compatibility)
        const savedGitHubUrl = loadFromLocalStorage('kernel-explorer-github-url', '') as string;
        const savedVersion = loadFromLocalStorage(
          'kernel-explorer-selected-version',
          'master'
        ) as string;

        if (savedGitHubUrl) {
          const urlMatch = savedGitHubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (urlMatch) {
            const [, savedOwner, savedRepo] = urlMatch;
            setGitHubRepoWithDefaultBranch(savedOwner, savedRepo, savedVersion || 'master').then(
              () => {
                setRepoLabel(`${savedOwner}/${savedRepo}`);
                const actualBranch = getCurrentBranch();
                setSelectedVersion(savedVersion || actualBranch || 'master');
              }
            );
          }
        }
      }
    }, 0);
  }, [owner, repo, branch]);

  // Load saved state after hydration to avoid SSR mismatch
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setIsHydrated(true);
      setSuggestions(getFundamentalConcepts());
      setRepoLabel(getCurrentRepoLabel());
    }, 0);

    if (typeof window !== 'undefined') {
      // Restore panel widths
      const savedSidebarWidth = localStorage.getItem('kernel-explorer-sidebar-width');
      const savedRightPanelWidth = localStorage.getItem('kernel-explorer-right-panel-width');

      // Restore tabs and active tab
      const savedTabs = loadFromLocalStorage('kernel-explorer-tabs', []) as EditorTab[];
      const savedActiveTabId = loadFromLocalStorage('kernel-explorer-active-tab', null) as
        | string
        | null;
      const savedSelectedFile = loadFromLocalStorage('kernel-explorer-selected-file', '') as string;

      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        if (savedSidebarWidth) {
          setSidebarWidth(parseInt(savedSidebarWidth, 10));
        }
        if (savedRightPanelWidth) {
          setRightPanelWidth(parseInt(savedRightPanelWidth, 10));
        }
        if (savedTabs.length > 0) {
          setTabs(savedTabs);
        }
        if (savedActiveTabId) {
          setActiveTabId(savedActiveTabId);
        }
        if (savedSelectedFile) {
          setSelectedFile(savedSelectedFile);
        }
        if (githubUrlRef.current) {
          const savedGitHubUrl = loadFromLocalStorage('kernel-explorer-github-url', '') as string;
          if (savedGitHubUrl) {
            githubUrlRef.current.value = savedGitHubUrl;
          }
        }
      }, 0);
    }
  }, []);

  // Save state to localStorage (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('kernel-explorer-sidebar-width', sidebarWidth.toString());
    }
  }, [sidebarWidth, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('kernel-explorer-right-panel-width', rightPanelWidth.toString());
    }
  }, [rightPanelWidth, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      saveToLocalStorage('kernel-explorer-tabs', tabs);
    }
  }, [tabs, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      saveToLocalStorage('kernel-explorer-active-tab', activeTabId);
    }
  }, [activeTabId, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      saveToLocalStorage('kernel-explorer-selected-file', selectedFile);
    }
  }, [selectedFile, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      saveToLocalStorage('kernel-explorer-selected-version', selectedVersion);
    }
  }, [selectedVersion, isHydrated]);

  // Resize handlers
  const handleMouseDown = useCallback((panel: 'sidebar' | 'rightPanel') => {
    setIsResizing(panel);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const minWidth = 200;
      const maxSidebarWidth = containerWidth * 0.4;
      const maxRightPanelWidth = containerWidth * 0.4;

      if (isResizing === 'sidebar') {
        const newWidth = Math.min(Math.max(e.clientX, minWidth), maxSidebarWidth);
        setSidebarWidth(newWidth);
      } else if (isResizing === 'rightPanel') {
        const newWidth = Math.min(
          Math.max(containerWidth - e.clientX, minWidth),
          maxRightPanelWidth
        );
        setRightPanelWidth(newWidth);
      }
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Tabs helpers
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;
  const generateTabId = (path: string) => `tab-${path.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

  const openFileInTab = useCallback(
    (filePath: string, searchPattern?: string) => {
      let normalizedPath = filePath.replace(/\/+$/, '');

      // Check if this is a Documentation folder - open index.rst instead
      if (filePath.startsWith('Documentation/') && filePath.endsWith('/')) {
        normalizedPath = `${normalizedPath}/index.rst`;
        // Continue to open the file instead of expanding directory
      } else if (filePath.endsWith('/')) {
        // For other directories, expand in explorer
        if (activeSidebarTab !== 'explorer') {
          setActiveSidebarTab('explorer');
        }
        setSelectedFile(normalizedPath);
        setDirectoryExpandRequest({ path: normalizedPath, id: Date.now() });
        return;
      }

      setSelectedFile(normalizedPath);
      const existing = tabs.find((t) => t.path === normalizedPath);
      if (existing) {
        setActiveTabId(existing.id);
        setTabs((prev) =>
          prev.map((t) => ({
            ...t,
            isActive: t.id === existing.id,
            searchPattern: t.id === existing.id ? searchPattern : t.searchPattern,
          }))
        );
        return;
      }
      const newTab: EditorTab = {
        id: generateTabId(normalizedPath),
        title: normalizedPath.split('/').pop() || normalizedPath,
        path: normalizedPath,
        isActive: true,
        isDirty: false,
        isLoading: true,
        searchPattern: searchPattern,
      };
      setTabs((prev) => [...prev.map((t) => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(newTab.id);
    },
    [tabs, activeSidebarTab]
  );

  const onTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    setTabs((prev) => prev.map((t) => ({ ...t, isActive: t.id === tabId })));
    const t = tabs.find((x) => x.id === tabId);
    if (t) setSelectedFile(t.path);
  };

  const onTabClose = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const nextTabs = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const newIdx = Math.max(0, idx - 1);
          const nextActive = nextTabs[newIdx] || null;
          setActiveTabId(nextActive ? nextActive.id : null);
          setSelectedFile(nextActive ? nextActive.path : '');
          setSuggestions(nextActive ? suggestions : getFundamentalConcepts());
        }
        return nextTabs;
      });
    },
    [activeTabId, suggestions]
  );

  const onEditorContentLoad = useCallback(
    (content: string) => {
      if (!activeTab) return;
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false, content } : t))
      );
      const sug = getAllSuggestionsForFile(activeTab.path, content);
      setSuggestions(sug.length ? sug : getFundamentalConcepts());

      // Update status bar info
      const lines = content.split('\n');
      setEditorLineCount(lines.length);
      const bytes = new TextEncoder().encode(content).length;
      if (bytes < 1024) {
        setEditorFileSize(`${bytes} B`);
      } else if (bytes < 1024 * 1024) {
        setEditorFileSize(`${(bytes / 1024).toFixed(1)} KB`);
      } else {
        setEditorFileSize(`${(bytes / (1024 * 1024)).toFixed(1)} MB`);
      }

      // Detect language from file extension
      const ext = activeTab.path.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        c: 'c',
        h: 'c',
        cpp: 'cpp',
        cc: 'cpp',
        cxx: 'cpp',
        s: 'asm',
        S: 'asm',
        py: 'python',
        sh: 'shell',
        rs: 'rust',
        go: 'go',
        js: 'javascript',
        ts: 'typescript',
        json: 'json',
        yaml: 'yaml',
        yml: 'yaml',
        md: 'markdown',
        txt: 'text',
        makefile: 'makefile',
      };
      setEditorLanguage(langMap[ext || ''] || 'text');
    },
    [activeTab]
  );

  // Guide content - complete guide with all 9 chapters
  const guideSections = useMemo(() => {
    // Chapter 1 Questions
    const ch1Questions: QuizQuestion[] = [
      {
        id: 'ch1-q1',
        question: 'What is the fundamental difference between the kernel and a process?',
        options: [
          'The kernel is a special process with elevated privileges',
          "The kernel is not a process—it's the system itself that serves processes",
          'The kernel is just a library that processes link against',
          'There is no difference; they are the same thing',
        ],
        correctAnswer: 1,
        explanation:
          "The kernel is not a process—it's the always-present system authority that bridges hardware and software, orchestrating all processes.",
      },
      {
        id: 'ch1-q2',
        question: "What is the kernel's primary responsibility?",
        options: [
          'To manage its own resources efficiently',
          'To support and serve user processes',
          'To optimize hardware performance',
          'To provide a graphical interface',
        ],
        correctAnswer: 1,
        explanation:
          "The kernel's primary role is to support user processes, ensuring their smooth execution rather than managing resources for its own benefit.",
      },
    ];

    // Chapter 2 Questions
    const ch2Questions: QuizQuestion[] = [
      {
        id: 'ch2-q1',
        question: "What is the Linux kernel's architectural model?",
        options: [
          'Microkernel with separate processes',
          'Monolithic in structure but coordinated in behavior',
          'Hybrid kernel with user-space drivers',
          'Exokernel with direct hardware access',
        ],
        correctAnswer: 1,
        explanation:
          'The Linux kernel is monolithic in structure but operates as a coordinated system where subsystems follow shared rules for timing, context, and concurrency.',
      },
      {
        id: 'ch2-q2',
        question: 'How does the kernel ensure safe concurrency?',
        options: [
          'By using only single-threaded code',
          'Through stateless, context-aware code with fine-grained locking',
          'By preventing all concurrent access',
          'By using only user-space synchronization',
        ],
        correctAnswer: 1,
        explanation:
          'The kernel ensures safe concurrency through stateless, context-aware code that operates on private data for each thread or process, using mechanisms like indirection, fine-grained locking, and RCU.',
      },
    ];

    // Chapter 3 Questions
    const ch3Questions: QuizQuestion[] = [
      {
        id: 'ch3-q1',
        question: 'How does the kernel view memory?',
        options: [
          'As a simple flat address space',
          'As a responsibility allocated based on subsystem needs',
          'As a fixed-size pool',
          'As user-space memory only',
        ],
        correctAnswer: 1,
        explanation:
          "The kernel doesn't view memory as a simple map, but as a responsibility, allocating it based on the specific needs and behaviors of each subsystem.",
      },
      {
        id: 'ch3-q2',
        question: 'What does the kernel enforce beyond code execution?',
        options: [
          'Only memory access',
          'Strict control over actions based on permissions, namespaces, capabilities, and execution context',
          'Only file system access',
          'Only network access',
        ],
        correctAnswer: 1,
        explanation:
          'The Linux kernel enforces strict control over actions based on permissions, namespaces, capabilities, and execution context to ensure processes operate within defined boundaries.',
      },
    ];

    // Chapter 4 Questions
    const ch4Questions: QuizQuestion[] = [
      {
        id: 'ch4-q1',
        question: 'What marks the transition from hardware setup to a functioning kernel?',
        options: ['The bootloader', 'The start_kernel() function', 'The init process', 'The shell'],
        correctAnswer: 1,
        explanation:
          'The transition from hardware setup to a fully functioning Linux kernel is marked by the start_kernel() function, which bridges architecture-specific setup and the architecture-neutral kernel core.',
      },
      {
        id: 'ch4-q2',
        question: 'What represents a process in the Linux kernel?',
        options: [
          'A file descriptor',
          'The task_struct data structure',
          'A memory page',
          'A system call',
        ],
        correctAnswer: 1,
        explanation:
          'In Linux, a process is represented by the task_struct, a data structure the kernel uses to manage execution, including memory, CPU state, and open files.',
      },
    ];

    // Chapter 5 Questions
    const ch5Questions: QuizQuestion[] = [
      {
        id: 'ch5-q1',
        question: 'How is the Linux kernel "entered"?',
        options: [
          'Only through system calls',
          'Through system calls, hardware interrupts, or exceptions',
          'Only through interrupts',
          'Only through exceptions',
        ],
        correctAnswer: 1,
        explanation:
          'The Linux kernel is "entered" rather than "run," with execution triggered by system calls, hardware interrupts, or exceptions.',
      },
      {
        id: 'ch5-q2',
        question: 'What happens to a syscall in a virtualized guest OS?',
        options: [
          'It is handled exactly like on the host',
          'It appears normal but may trigger VMEXIT for privileged actions',
          'It is always blocked',
          'It bypasses the guest kernel',
        ],
        correctAnswer: 1,
        explanation:
          'In a guest OS, the syscall appears to be handled normally by the guest kernel, but if privileged actions are needed (like accessing hardware), it triggers a VMEXIT.',
      },
    ];

    // Chapter 6 Questions
    const ch6Questions: QuizQuestion[] = [
      {
        id: 'ch6-q1',
        question: 'How does Linux maintain structure across tasks?',
        options: [
          'By using a stateless CPU and stateful kernel',
          'By keeping all state in the CPU',
          'By using only user-space state',
          'By avoiding context switching',
        ],
        correctAnswer: 0,
        explanation:
          'The division between stateless execution and stateful management defines how Linux maintains structure across tasks. The CPU executes blindly, while the kernel preserves all context externally.',
      },
      {
        id: 'ch6-q2',
        question: 'What is an interrupt in the kernel?',
        options: [
          'An unexpected disruption',
          'A deliberate mechanism prepared in advance for system response',
          'A bug in the code',
          'A user-space event',
        ],
        correctAnswer: 1,
        explanation:
          'An interrupt is a deliberate mechanism, prepared in advance, through which the system responds to events that occur independently of any running task.',
      },
    ];

    // Chapter 7 Questions
    const ch7Questions: QuizQuestion[] = [
      {
        id: 'ch7-q1',
        question: 'How do kernel modules interact with each other?',
        options: [
          'Through direct function calls',
          'Only through explicitly exported symbols',
          'Through shared global variables',
          'Through user-space interfaces',
        ],
        correctAnswer: 1,
        explanation:
          'Kernel modules in Linux interact only through explicitly exported symbols, ensuring isolation and system stability.',
      },
      {
        id: 'ch7-q2',
        question: 'What interfaces exist between user space and the kernel?',
        options: [
          'Only system calls',
          'Syscalls, /proc, ioctl, mmap, and eBPF',
          'Only /proc',
          'Only ioctl',
        ],
        correctAnswer: 1,
        explanation:
          "Understanding the various interfaces between user space and the Linux kernel—such as syscalls, /proc, ioctl, mmap, and eBPF—provides insight into the kernel's flexibility.",
      },
    ];

    // Chapter 8 Questions
    const ch8Questions: QuizQuestion[] = [
      {
        id: 'ch8-q1',
        question: 'What is the key difference between multitasking and virtualization?',
        options: [
          'Multitasking uses multiple CPUs, virtualization uses one',
          'Multitasking manages multiple processes on one OS, virtualization runs multiple OSes on one machine',
          'There is no difference',
          'Multitasking is for servers, virtualization is for desktops',
        ],
        correctAnswer: 1,
        explanation:
          'Multitasking allows a single OS to manage multiple processes, whereas virtualization enables multiple OSes to run on a single machine, each believing it controls its own hardware.',
      },
      {
        id: 'ch8-q2',
        question: 'What is the advantage of io_uring over epoll?',
        options: [
          'It uses fewer system calls',
          'It allows submitting operations in advance via shared memory, reducing overhead',
          'It works only with files',
          'It requires less memory',
        ],
        correctAnswer: 1,
        explanation:
          'io_uring enhances Linux I/O by allowing applications to submit operations in advance via a shared memory ring, reducing overhead and eliminating extra syscalls.',
      },
    ];

    // Chapter 9 Questions
    const ch9Questions: QuizQuestion[] = [
      {
        id: 'ch9-q1',
        question: 'Why is the kernel always present even when not running?',
        options: [
          'It runs continuously in a loop',
          'It is always mapped into memory and activated when needed',
          'It is loaded into every process',
          'It never sleeps',
        ],
        correctAnswer: 1,
        explanation:
          'The kernel remains a constant presence in the system, always mapped into memory but only activated when needed through system calls and interrupts.',
      },
      {
        id: 'ch9-q2',
        question: 'Why do kernels stay in C?',
        options: [
          'Because of tradition',
          'For precision, determinism, full control, and alignment with hardware',
          'Because C is the easiest language',
          'Because other languages are not available',
        ],
        correctAnswer: 1,
        explanation:
          'C remains the language of choice not out of tradition, but because it offers unmatched alignment with hardware, build-time configurability, and structural clarity without abstraction overhead.',
      },
    ];

    return [
      {
        id: 'ch1',
        title: 'Chapter 1 — Understanding Linux Kernel Before Code',
        body: (
          <div>
            <p>
              The kernel isn&apos;t a process—it&apos;s the system. It serves user processes, reacts
              to context, and enforces separation and control.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>
                The kernel is not a process but the very foundation that orchestrates the entire
                system
              </li>
              <li>The kernel&apos;s primary role is to support user processes</li>
              <li>The kernel operates as a layered system that enforces structure at runtime</li>
            </ul>
            <FileRecommendations
              docs={[
                {
                  path: 'Documentation/scheduler/sched-design-CFS.rst',
                  description: 'Scheduler design and kernel thread management',
                },
                { path: 'Documentation/core-api/kernel-api.rst', description: 'Kernel thread API' },
                {
                  path: 'Documentation/core-api/',
                  description: 'Core kernel APIs including system calls',
                },
                {
                  path: 'Documentation/kernel-hacking/locking.rst',
                  description: 'System call and interrupt handling',
                },
                { path: 'Documentation/mm/', description: 'Memory mapping and isolation' },
                {
                  path: 'Documentation/admin-guide/mm/',
                  description: 'Memory management administration',
                },
              ]}
              source={[
                { path: 'kernel/sched/', description: 'Scheduler implementation' },
                { path: 'kernel/sched/core.c', description: 'Core scheduler logic' },
                { path: 'kernel/sched/fair.c', description: 'CFS scheduler implementation' },
                { path: 'include/linux/sched.h', description: 'Process and thread structures' },
                { path: 'kernel/fork.c', description: 'Process creation' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch1"
              questions={ch1Questions}
              onComplete={(score, total) => markQuizComplete('ch1', score, total)}
              isCompleted={getChapterProgress('ch1').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch2',
        title: 'Chapter 2 — System Foundations',
        body: (
          <div>
            <p>
              The Linux kernel is a modular, secure core that manages hardware, memory, processes,
              and user space to ensure stability and security.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>Monolithic form with coordinated behavior</li>
              <li>Kernel objects reveal the design (task_struct, msg_queue, inode)</li>
              <li>Safe concurrency through stateless, context-aware code</li>
              <li>The power of indirection for per-thread references</li>
              <li>Device model: how hardware becomes /dev</li>
            </ul>
            <FileRecommendations
              docs={[
                { path: 'Documentation/scheduler/', description: 'Scheduler documentation' },
                { path: 'Documentation/mm/', description: 'Memory management' },
                { path: 'Documentation/filesystems/', description: 'Filesystem documentation' },
                { path: 'Documentation/kernel-hacking/', description: 'Kernel development guide' },
                { path: 'Documentation/core-api/', description: 'Core kernel APIs' },
                {
                  path: 'Documentation/scheduler/sched-design-CFS.rst',
                  description: 'Process and thread structures',
                },
                {
                  path: 'Documentation/filesystems/vfs.rst',
                  description: 'VFS and inode structures',
                },
                { path: 'Documentation/ipc/', description: 'IPC structures' },
                { path: 'Documentation/locking/', description: 'Locking mechanisms' },
                { path: 'Documentation/locking/spinlocks.rst', description: 'Spinlock primitives' },
                { path: 'Documentation/RCU/', description: 'RCU (Read-Copy-Update) mechanism' },
                {
                  path: 'Documentation/kernel-hacking/locking.rst',
                  description: 'Per-thread context and current pointer',
                },
                { path: 'Documentation/driver-api/', description: 'Device driver API' },
                { path: 'Documentation/driver-api/driver-model/', description: 'Device model' },
                { path: 'Documentation/admin-guide/devices.rst', description: 'Device files' },
                { path: 'Documentation/kbuild/', description: 'Kernel build system' },
                {
                  path: 'Documentation/admin-guide/kernel-parameters.rst',
                  description: 'Kernel parameters',
                },
              ]}
              source={[
                {
                  path: 'kernel/',
                  description:
                    'Core kernel functionality: scheduling, process management, system calls',
                },
                {
                  path: 'mm/',
                  description: 'Memory management: allocation, page tables, and virtual memory',
                },
                { path: 'fs/', description: 'Filesystem layer: VFS, inodes, and file operations' },
                {
                  path: 'net/',
                  description: 'Networking stack: protocols, sockets, and network interfaces',
                },
                {
                  path: 'drivers/',
                  description: 'Device drivers: hardware abstraction and device model',
                },
                {
                  path: 'arch/x86/',
                  description:
                    'x86 architecture-specific code: entry points and low-level operations',
                },
                { path: 'include/linux/sched.h', description: 'task_struct definition' },
                { path: 'include/linux/fs.h', description: 'File system structures' },
                { path: 'include/linux/spinlock.h', description: 'Spinlock primitives' },
                { path: 'kernel/locking/', description: 'Locking mechanisms' },
                { path: 'drivers/base/core.c', description: 'Device model core' },
                { path: 'drivers/base/bus.c', description: 'Bus subsystem' },
                { path: 'ipc/', description: 'IPC mechanisms' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch2"
              questions={ch2Questions}
              onComplete={(score, total) => markQuizComplete('ch2', score, total)}
              isCompleted={getChapterProgress('ch2').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch3',
        title: 'Chapter 3 — Memory, Isolation, and Enforcement',
        body: (
          <div>
            <p>
              The kernel doesn&apos;t view memory as a simple map, but as a responsibility,
              allocating it based on the specific needs and behaviors of each subsystem.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>Memory is not a place—it&apos;s a system (NUMA, zones, pages)</li>
              <li>Memory lifecycle and the roles that shape it</li>
              <li>Shared code, separate state in kernel memory management</li>
              <li>The kernel is always there—understanding its memory structure</li>
              <li>Enforcement beyond code execution: permissions, namespaces, capabilities</li>
            </ul>
            <FileRecommendations
              docs={[
                {
                  path: 'Documentation/core-api/memory-allocation.rst',
                  description: 'Memory allocation APIs',
                },
                { path: 'Documentation/mm/', description: 'Memory management overview' },
                { path: 'Documentation/admin-guide/mm/', description: 'Memory zones and NUMA' },
                { path: 'Documentation/virt/', description: 'Virtual memory documentation' },
                {
                  path: 'Documentation/arch/x86/x86_64/mm.rst',
                  description: 'x86_64 memory layout',
                },
                { path: 'Documentation/userspace-api/', description: 'User space APIs' },
                { path: 'Documentation/security/', description: 'Security framework' },
              ]}
              source={[
                { path: 'mm/', description: 'Memory management subsystem' },
                { path: 'mm/page_alloc.c', description: 'Page allocation' },
                { path: 'mm/memory.c', description: 'Memory management core' },
                { path: 'mm/vmalloc.c', description: 'Virtual memory allocation' },
                { path: 'mm/slab.c', description: 'Slab allocator' },
                { path: 'include/linux/gfp.h', description: 'GFP flags for memory allocation' },
                { path: 'include/linux/mm_types.h', description: 'Memory type definitions' },
                { path: 'include/linux/mm.h', description: 'Memory management headers' },
                { path: 'kernel/capability.c', description: 'POSIX capabilities' },
                { path: 'include/linux/capability.h', description: 'Capability definitions' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch3"
              questions={ch3Questions}
              onComplete={(score, total) => markQuizComplete('ch3', score, total)}
              isCompleted={getChapterProgress('ch3').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch4',
        title: "Chapter 4 — Boot, Init, and the Kernel's Entry",
        body: (
          <div>
            <p>
              The transition from hardware setup to a fully functioning Linux kernel is marked by
              staged initialization that brings online critical subsystems.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>Where boot ends: the kernel begins with start_kernel()</li>
              <li>From vmlinuz to eBPF: what actually runs inside the kernel</li>
              <li>What really happens when you run ./hello</li>
              <li>How a Linux process works from the kernel&apos;s point of view</li>
            </ul>
            <FileRecommendations
              docs={[
                {
                  path: 'Documentation/admin-guide/kernel-parameters.rst',
                  description: 'Kernel boot parameters',
                },
                { path: 'Documentation/x86/boot.rst', description: 'x86 boot process' },
                { path: 'Documentation/kernel-hacking/modules.rst', description: 'Kernel modules' },
                { path: 'Documentation/bpf/', description: 'eBPF subsystem' },
                {
                  path: 'Documentation/admin-guide/module-signing.rst',
                  description: 'Module interface',
                },
                {
                  path: 'Documentation/admin-guide/binfmt-misc.rst',
                  description: 'Binary format handlers',
                },
                { path: 'Documentation/core-api/', description: 'System call interface' },
                {
                  path: 'Documentation/scheduler/sched-design-CFS.rst',
                  description: 'Process and thread structures',
                },
              ]}
              source={[
                { path: 'init/main.c', description: 'Kernel initialization - start_kernel()' },
                { path: 'kernel/fork.c', description: 'Process creation with fork() and clone()' },
                { path: 'kernel/exit.c', description: 'Process termination' },
                { path: 'kernel/module.c', description: 'Kernel module management' },
                { path: 'include/linux/module.h', description: 'Module definitions' },
                {
                  path: 'arch/x86/kernel/',
                  description: 'x86 architecture-specific initialization',
                },
                { path: 'fs/exec.c', description: 'execve() implementation' },
                { path: 'include/linux/sched.h', description: 'task_struct definition' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch4"
              questions={ch4Questions}
              onComplete={(score, total) => markQuizComplete('ch4', score, total)}
              isCompleted={getChapterProgress('ch4').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch5',
        title: 'Chapter 5 — Entering the Kernel',
        body: (
          <div>
            <p>
              The Linux kernel is &quot;entered&quot; rather than &quot;run,&quot; with execution
              triggered by system calls, hardware interrupts, or exceptions.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>How the kernel is entered: syscalls, traps, and interrupts</li>
              <li>Syscalls from two perspectives: the host and the guest OS</li>
              <li>Where system calls are handled in the Linux kernel</li>
            </ul>
            <FileRecommendations
              docs={[
                { path: 'Documentation/core-api/', description: 'System call interface' },
                { path: 'Documentation/core-api/irq/', description: 'Interrupt handling' },
                {
                  path: 'Documentation/kernel-hacking/locking.rst',
                  description: 'Interrupt context',
                },
                { path: 'Documentation/virt/kvm/', description: 'KVM virtualization' },
                { path: 'Documentation/virt/kvm/api.txt', description: 'KVM API' },
                {
                  path: 'Documentation/userspace-api/',
                  description: 'User space API documentation',
                },
              ]}
              source={[
                { path: 'arch/x86/entry/', description: 'System call entry points' },
                { path: 'arch/x86/entry/syscalls/', description: 'System call table' },
                { path: 'kernel/sys.c', description: 'System call implementations' },
                { path: 'kernel/irq/', description: 'Interrupt handling' },
                { path: 'kernel/softirq.c', description: 'Software interrupts' },
                { path: 'include/linux/uaccess.h', description: 'User space access helpers' },
                { path: 'arch/x86/lib/usercopy.c', description: 'User space copy functions' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch5"
              questions={ch5Questions}
              onComplete={(score, total) => markQuizComplete('ch5', score, total)}
              isCompleted={getChapterProgress('ch5').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch6',
        title: 'Chapter 6 — Execution and Contexts',
        body: (
          <div>
            <p>
              The distinct execution paths in the Linux kernel are designed to ensure system
              stability, responsiveness, and efficiency.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>Stateless CPU, stateful kernel: how execution is orchestrated</li>
              <li>What the kernel builds—layer by layer</li>
              <li>Kernel execution paths: what runs where, and why it matters</li>
              <li>An interrupt is not a disruption—it&apos;s design</li>
              <li>Execution is logical, placement is physical</li>
              <li>Synchronization beyond concurrency</li>
              <li>What makes a kernel thread &quot;kernel&quot;?</li>
            </ul>
            <FileRecommendations
              docs={[
                {
                  path: 'Documentation/scheduler/',
                  description: 'Context switching and scheduling',
                },
                {
                  path: 'Documentation/scheduler/sched-design-CFS.rst',
                  description: 'Task state structures and CFS scheduler design',
                },
                { path: 'Documentation/core-api/irq/', description: 'Interrupt handling' },
                {
                  path: 'Documentation/core-api/workqueue.rst',
                  description: 'Workqueue mechanism',
                },
                {
                  path: 'Documentation/kernel-hacking/locking.rst',
                  description: 'Preemption control',
                },
                {
                  path: 'Documentation/driver-api/',
                  description: 'Device driver interrupt handling',
                },
                { path: 'Documentation/locking/', description: 'Locking mechanisms' },
                { path: 'Documentation/locking/spinlocks.rst', description: 'Spinlocks' },
                { path: 'Documentation/locking/mutex-design.rst', description: 'Mutexes' },
                { path: 'Documentation/RCU/', description: 'RCU synchronization' },
                { path: 'Documentation/core-api/kernel-api.rst', description: 'Kernel thread API' },
                { path: 'Documentation/admin-guide/mm/', description: 'Memory migration' },
              ]}
              source={[
                { path: 'kernel/sched/', description: 'Scheduler implementation' },
                { path: 'kernel/sched/core.c', description: 'Core scheduler logic' },
                { path: 'kernel/sched/fair.c', description: 'CFS scheduler' },
                { path: 'kernel/sched/rt.c', description: 'Real-time scheduler' },
                { path: 'kernel/softirq.c', description: 'Software interrupts' },
                { path: 'kernel/workqueue.c', description: 'Workqueue implementation' },
                { path: 'kernel/irq/', description: 'Interrupt subsystem' },
                { path: 'kernel/locking/', description: 'Locking primitives' },
                { path: 'include/linux/spinlock.h', description: 'Spinlock definitions' },
                { path: 'include/linux/mutex.h', description: 'Mutex definitions' },
                { path: 'include/linux/sched.h', description: 'task_struct and scheduling' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch6"
              questions={ch6Questions}
              onComplete={(score, total) => markQuizComplete('ch6', score, total)}
              isCompleted={getChapterProgress('ch6').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch7',
        title: 'Chapter 7 — Communication and Cooperation',
        body: (
          <div>
            <p>
              Inside the Linux kernel, communication across different contexts is managed through
              specialized tools to ensure safe, efficient coordination.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>How the kernel talks to itself—tools for internal communication</li>
              <li>Kernel modules know each other only through exported symbols</li>
              <li>Bridging the gaps between components</li>
              <li>Beyond libc: how user space really talks to the kernel</li>
              <li>Understanding interface layers from user space to the kernel</li>
              <li>What really happens when you call open() in Linux?</li>
            </ul>
            <FileRecommendations
              docs={[
                { path: 'Documentation/core-api/workqueue.rst', description: 'Workqueues' },
                { path: 'Documentation/core-api/irq/', description: 'Soft interrupts' },
                { path: 'Documentation/core-api/', description: 'Wait queues and synchronization' },
                {
                  path: 'Documentation/kernel-hacking/modules.rst',
                  description: 'Module management',
                },
                { path: 'Documentation/kernel-hacking/symbols.rst', description: 'Symbol export' },
                { path: 'Documentation/filesystems/', description: 'Filesystem layer' },
                { path: 'Documentation/block/', description: 'Block layer' },
                { path: 'Documentation/filesystems/proc.rst', description: '/proc filesystem' },
                { path: 'Documentation/filesystems/sysfs.rst', description: 'sysfs filesystem' },
                { path: 'Documentation/bpf/', description: 'eBPF subsystem' },
                { path: 'Documentation/userspace-api/', description: 'System call interface' },
                { path: 'Documentation/filesystems/vfs.rst', description: 'VFS layer' },
              ]}
              source={[
                { path: 'ipc/', description: 'IPC mechanisms' },
                { path: 'ipc/msg.c', description: 'Message queues' },
                { path: 'ipc/sem.c', description: 'Semaphores' },
                { path: 'ipc/shm.c', description: 'Shared memory' },
                { path: 'include/linux/msg.h', description: 'Message queue structures' },
                { path: 'fs/open.c', description: 'open() implementation' },
                { path: 'fs/namei.c', description: 'Path resolution (namei)' },
                { path: 'fs/read_write.c', description: 'File read/write operations' },
                { path: 'fs/inode.c', description: 'Inode operations' },
                { path: 'include/linux/fs.h', description: 'File system structures' },
                { path: 'kernel/module.c', description: 'Module symbol exports' },
                { path: 'include/linux/export.h', description: 'EXPORT_SYMBOL macros' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch7"
              questions={ch7Questions}
              onComplete={(score, total) => markQuizComplete('ch7', score, total)}
              isCompleted={getChapterProgress('ch7').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch8',
        title: 'Chapter 8 — Scheduling, I/O, and Virtualization',
        body: (
          <div>
            <p>
              When an application reads from or writes to a file, the request travels through a
              series of kernel subsystems that transform user-level operations into low-level disk
              access.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>From intent to I/O: how the kernel sees files, disks, and devices</li>
              <li>The CPU doesn&apos;t move the data—but nothing moves without it</li>
              <li>Time and precision: the kernel&apos;s view of CPU execution</li>
              <li>How select() and poll() paved the way for epoll()</li>
              <li>Beyond epoll(): how io_uring redefines Linux I/O</li>
              <li>Multitasking vs virtualization—what&apos;s the real difference?</li>
              <li>The kernel&apos;s role in virtualization: understanding KVM</li>
              <li>VirtIO: network drivers without emulation</li>
            </ul>
            <FileRecommendations
              docs={[
                { path: 'Documentation/filesystems/', description: 'File I/O operations' },
                { path: 'Documentation/block/', description: 'Block layer' },
                { path: 'Documentation/driver-api/', description: 'Device drivers' },
                { path: 'Documentation/core-api/dma-api.rst', description: 'DMA interface' },
                { path: 'Documentation/x86/', description: 'x86 architecture documentation' },
                { path: 'Documentation/core-api/timekeeping.rst', description: 'Time management' },
                { path: 'Documentation/timers/', description: 'Timer subsystem' },
                { path: 'Documentation/userspace-api/', description: 'User space I/O APIs' },
                { path: 'Documentation/core-api/io_uring.rst', description: 'io_uring interface' },
                {
                  path: 'Documentation/userspace-api/io_uring/',
                  description: 'io_uring user space API',
                },
                { path: 'Documentation/virtual/', description: 'Virtualization documentation' },
                { path: 'Documentation/virt/kvm/', description: 'KVM implementation' },
                { path: 'Documentation/virt/kvm/api.txt', description: 'KVM API' },
                { path: 'Documentation/virt/kvm/x86/', description: 'x86 virtualization' },
                { path: 'Documentation/virtual/virtio/', description: 'VirtIO drivers' },
                { path: 'Documentation/virtual/virtio-net.rst', description: 'VirtIO networking' },
              ]}
              source={[
                { path: 'fs/', description: 'Filesystem layer' },
                { path: 'fs/namei.c', description: 'Path resolution' },
                { path: 'fs/open.c', description: 'File opening' },
                { path: 'fs/read_write.c', description: 'File read/write' },
                { path: 'fs/inode.c', description: 'Inode operations' },
                { path: 'block/', description: 'Block layer' },
                { path: 'drivers/', description: 'Device drivers' },
                { path: 'include/linux/fs.h', description: 'File system structures' },
                { path: 'include/linux/blkdev.h', description: 'Block device definitions' },
                { path: 'io_uring/', description: 'io_uring implementation' },
                { path: 'kernel/time/', description: 'Time management' },
                { path: 'arch/x86/kvm/', description: 'KVM x86 implementation' },
                { path: 'drivers/virtio/', description: 'VirtIO drivers' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch8"
              questions={ch8Questions}
              onComplete={(score, total) => markQuizComplete('ch8', score, total)}
              isCompleted={getChapterProgress('ch8').quizCompleted}
            />
          </div>
        ),
      },
      {
        id: 'ch9',
        title: 'Chapter 9 — Concluding Insights',
        body: (
          <div>
            <p>
              The kernel remains a constant presence in the system, always mapped into memory but
              only activated when needed.
            </p>
            <p>
              <strong>Key Concepts:</strong>
            </p>
            <ul>
              <li>Why the kernel is always there—even when it&apos;s not running</li>
              <li>All that still runs through it</li>
              <li>Alignment is understanding</li>
              <li>Efficiency, not legacy: why kernels stay in C</li>
            </ul>
            <FileRecommendations
              docs={[
                { path: 'Documentation/core-api/', description: 'System call interface' },
                { path: 'Documentation/x86/', description: 'Architecture entry points' },
                { path: 'Documentation/kernel-hacking/', description: 'Kernel development guide' },
                { path: 'Documentation/kbuild/', description: 'Build system' },
              ]}
              source={[
                { path: 'arch/x86/entry/', description: 'System call entry points' },
                { path: 'kernel/', description: 'Core kernel subsystems' },
                { path: 'include/linux/', description: 'Kernel headers' },
              ]}
              onFileClick={openFileInTab}
            />
            <ChapterQuiz
              chapterId="ch9"
              questions={ch9Questions}
              onComplete={(score, total) => markQuizComplete('ch9', score, total)}
              isCompleted={getChapterProgress('ch9').quizCompleted}
            />
          </div>
        ),
      },
    ];
  }, [markQuizComplete, getChapterProgress, openFileInTab]);

  // Command palette commands
  const commandPaletteCommands = useMemo(
    () => [
      {
        id: 'open-file',
        label: 'Open File',
        icon: '📄',
        category: 'File',
        action: () => {
          if (activeSidebarTab !== 'explorer') {
            setActiveSidebarTab('explorer');
          }
          setIsSidebarOpen(true);
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: 'toggle-sidebar',
        label: 'Toggle Sidebar',
        icon: '📁',
        category: 'View',
        action: () => {
          setIsSidebarOpen(!isSidebarOpen);
          setIsCommandPaletteOpen(false);
        },
      },
    ],
    [activeSidebarTab, isSidebarOpen]
  );

  // Loading screen
  if (isInitialLoading) {
    return (
      <>
        <style>{`
          @keyframes vscode-loading-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          .vscode-loading-container {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: var(--vscode-editor-background, #1e1e1e);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 9999;
          }
        `}</style>
        <div className="vscode-loading-container">
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #007acc 0%, #005a9e 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
              }}
            >
              🏴‍☠️
            </div>
            <div style={{ color: 'var(--vscode-foreground, #cccccc)', fontSize: '16px' }}>
              Loading Explorer...
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="vscode-container">
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandPaletteCommands}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!isMobile && (
          <ActivityBar
            activeView={activeSidebarTab}
            onViewChange={(view) => {
              setActiveSidebarTab(view);
              setIsSidebarOpen(true);
            }}
          />
        )}

        <div
          className={`vscode-sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}
          suppressHydrationWarning
          style={{ width: `${sidebarWidth}px`, minWidth: '180px', maxWidth: '40vw' }}
        >
          <div className="vscode-sidebar-content">
            {activeSidebarTab === 'explorer' && (
              <FileTree
                onFileSelect={openFileInTab}
                selectedFile={selectedFile}
                listDirectory={buildFileTree}
                titleLabel={repoLabel}
                refreshKey={treeRefreshKey}
                expandDirectoryRequest={directoryExpandRequest}
                onDirectoryExpand={(path: string) => {
                  if (activeSidebarTab !== 'explorer') {
                    setActiveSidebarTab('explorer');
                  }
                  setSelectedFile(path);
                }}
              />
            )}

            {activeSidebarTab === 'data-structures' && (
              <DataStructuresView
                onFileOpen={(filePath, structName) => {
                  openFileInTab(filePath, structName);
                }}
              />
            )}
          </div>
        </div>

        <div
          className="resize-handle"
          onMouseDown={() => handleMouseDown('sidebar')}
          suppressHydrationWarning
          style={{
            width: '4px',
            backgroundColor: isResizing === 'sidebar' ? 'var(--vscode-text-accent)' : 'transparent',
            cursor: 'col-resize',
            borderRight: '1px solid var(--vscode-border)',
          }}
        />

        <div
          className="vscode-editor-container"
          style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}
        >
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
          />
          {activeTab ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <CodeEditorContainer
                filePath={activeTab.path}
                onContentLoad={onEditorContentLoad}
                fetchFile={fetchFileContent}
                repoLabel={repoLabel}
                scrollToLine={activeTab.scrollToLine}
                searchPattern={activeTab.searchPattern}
                onCursorChange={(line, column) => {
                  setEditorLine(line);
                  setEditorColumn(column);
                }}
              />
            </div>
          ) : (
            <div className="vscode-empty-state">
              <div className="vscode-empty-icon">🐧</div>
              <div>Open a file from the explorer to begin</div>
            </div>
          )}
        </div>

        <div
          className="resize-handle"
          onMouseDown={() => handleMouseDown('rightPanel')}
          suppressHydrationWarning
          style={{
            width: '4px',
            backgroundColor:
              isResizing === 'rightPanel' ? 'var(--vscode-text-accent)' : 'transparent',
            cursor: 'col-resize',
            borderLeft: '1px solid var(--vscode-border)',
          }}
        />

        <div
          className={`vscode-panel ${isRightPanelOpen ? 'mobile-open' : ''}`}
          suppressHydrationWarning
          style={{ width: `${rightPanelWidth}px`, minWidth: '200px', maxWidth: '40vw' }}
        >
          <GuidePanel
            sections={guideSections}
            defaultOpenIds={['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9']}
            overallProgress={progress.overallProgress}
            chapterProgress={Object.fromEntries(
              Object.entries(progress.chapters).map(([id, ch]) => [id, ch.quizCompleted])
            )}
            onResetProgress={resetProgress}
          />
        </div>
      </div>

      <StatusBar
        filePath={activeTab?.path}
        line={editorLine}
        column={editorColumn}
        language={editorLanguage}
        lineCount={editorLineCount}
        fileSize={editorFileSize}
        repoLabel={repoLabel}
      />
    </div>
  );
}
