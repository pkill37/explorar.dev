"use client";
import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import FileTree from "@/components/FileTree";
import TabBar from "@/components/TabBar";
import CodeEditorContainer from "@/components/CodeEditorContainer";
import GuidePanel from "@/components/GuidePanel";
import ChapterQuiz, { QuizQuestion } from "@/components/ChapterQuiz";
import DataStructuresView from "@/components/DataStructuresView";
import ActivityBar from "@/components/ActivityBar";
import StatusBar from "@/components/StatusBar";
import Breadcrumbs from "@/components/Breadcrumbs";
import CommandPalette from "@/components/CommandPalette";
import { EditorTab, KernelSuggestion } from "@/types";
import { buildFileTree, fetchFileContent, getCurrentRepoLabel } from "@/lib/github-api";
import { getAllSuggestionsForFile, getFundamentalConcepts } from "@/lib/kernel-suggestions";
import { useKernelProgress } from "@/hooks/useKernelProgress";
import "@/app/linux-kernel-explorer/vscode.css";

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

export default function KernelExplorer() {
  const githubUrlRef = useRef<HTMLInputElement>(null);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [directoryExpandRequest, setDirectoryExpandRequest] = useState<{ path: string; id: number } | null>(null);
  // Initialize with consistent values for SSR (will be updated after hydration)
  const [suggestions, setSuggestions] = useState<KernelSuggestion[]>([]);
  const [repoLabel, setRepoLabel] = useState<string>("torvalds/linux");
  const [treeRefreshKey] = useState<string>("init");
  
  // Kernel version state
  const [selectedVersion, setSelectedVersion] = useState<string>('master');
  
  // Progress tracking for chapters
  const chapterIds = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9'];
  const { progress, markQuizComplete, getChapterProgress } = useKernelProgress(chapterIds);
  
  // Panel width state - start with defaults to avoid hydration mismatch
  const [sidebarWidth, setSidebarWidth] = useState<number>(220);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  
  // Sidebar tab state
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'data-structures'>('explorer');
  
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
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTablet, setIsTablet] = useState<boolean>(false);
  
  // Initial loading state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  
  // Check if mobile/tablet on mount and resize
  useEffect(() => {
    const checkViewport = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
        setIsTablet(window.innerWidth <= 1024);
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
      const savedActiveTabId = loadFromLocalStorage('kernel-explorer-active-tab', null) as string | null;
      const savedSelectedFile = loadFromLocalStorage('kernel-explorer-selected-file', '') as string;

      // Restore last used GitHub URL
      const savedGitHubUrl = loadFromLocalStorage('kernel-explorer-github-url', '') as string;

      // Restore selected version
      const savedVersion = loadFromLocalStorage('kernel-explorer-selected-version', 'master') as string;
      
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
        if (savedGitHubUrl && githubUrlRef.current) {
          githubUrlRef.current.value = savedGitHubUrl;
        }
        if (savedVersion) {
          setSelectedVersion(savedVersion);
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

  // Note: Kernel versions fetching removed as it's not currently used in the UI

  // Resize handlers
  const handleMouseDown = useCallback((panel: 'sidebar' | 'rightPanel') => {
    setIsResizing(panel);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const minWidth = 200;
    const maxSidebarWidth = containerWidth * 0.4;
    const maxRightPanelWidth = containerWidth * 0.4;

    if (isResizing === 'sidebar') {
      const newWidth = Math.min(Math.max(e.clientX, minWidth), maxSidebarWidth);
      setSidebarWidth(newWidth);
    } else if (isResizing === 'rightPanel') {
      const newWidth = Math.min(Math.max(containerWidth - e.clientX, minWidth), maxRightPanelWidth);
      setRightPanelWidth(newWidth);
    }
  }, [isResizing]);

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
  const generateTabId = (path: string) => `tab-${path.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`;

  const openFileInTab = useCallback((filePath: string, searchPattern?: string) => {
    const normalizedPath = filePath.replace(/\/+$/, '');
    
    // Check if this is a directory (original path ended with /)
    if (filePath.endsWith('/')) {
      if (activeSidebarTab !== 'explorer') {
        setActiveSidebarTab('explorer');
      }
      setSelectedFile(normalizedPath);
      setDirectoryExpandRequest({ path: normalizedPath, id: Date.now() });
      return;
    }
    
    setSelectedFile(normalizedPath);
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      setTabs((prev) => prev.map((t) => ({ 
        ...t, 
        isActive: t.id === existing.id,
        searchPattern: t.id === existing.id ? searchPattern : t.searchPattern
      })));
      return;
    }
    const newTab: EditorTab = {
      id: generateTabId(filePath),
      title: filePath.split('/').pop() || filePath,
      path: filePath,
      isActive: true,
      isDirty: false,
      isLoading: true,
      searchPattern: searchPattern,
    };
    setTabs((prev) => [...prev.map((t) => ({ ...t, isActive: false })), newTab]);
    setActiveTabId(newTab.id);
  }, [tabs, activeSidebarTab]);

  const onTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    setTabs((prev) => prev.map((t) => ({ ...t, isActive: t.id === tabId })));
    const t = tabs.find((x) => x.id === tabId);
    if (t) setSelectedFile(t.path);
  };

  const onTabClose = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const nextTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        const newIdx = Math.max(0, idx - 1);
        const nextActive = nextTabs[newIdx] || null;
        setActiveTabId(nextActive ? nextActive.id : null);
        setSelectedFile(nextActive ? nextActive.path : "");
        setSuggestions(nextActive ? suggestions : getFundamentalConcepts());
      }
      return nextTabs;
    });
  }, [activeTabId, suggestions]);

  const onEditorContentLoad = useCallback((content: string) => {
    if (!activeTab) return;
    setTabs((prev) => prev.map((t) => t.id === activeTab.id ? { ...t, isLoading: false, content } : t));
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
      'c': 'c', 'h': 'c', 'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      's': 'asm', 'S': 'asm', 'py': 'python', 'sh': 'shell',
      'rs': 'rust', 'go': 'go', 'js': 'javascript', 'ts': 'typescript',
      'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown',
      'txt': 'text', 'makefile': 'makefile'
    };
    setEditorLanguage(langMap[ext || ''] || 'text');
  }, [activeTab]);

  // Note: handleGithubLoad and handleVersionChange removed as they're not currently used in the UI





  // Guide content
  const guideSections = useMemo(() => {
    const ch1Questions: QuizQuestion[] = [
      {
        id: 'ch1-q1',
        question: 'What is the fundamental difference between the kernel and a process?',
        options: [
          'The kernel is a special process with elevated privileges',
          'The kernel is not a process—it\'s the system itself that serves processes',
          'The kernel is just a library that processes link against',
          'There is no difference; they are the same thing'
        ],
        correctAnswer: 1,
        explanation: 'The kernel is not a process—it\'s the always-present system authority that bridges hardware and software, orchestrating all processes.'
      },
      {
        id: 'ch1-q2',
        question: 'How does the kernel primarily serve user processes?',
        options: [
          'By running as a background daemon',
          'By orchestrating syscalls, interrupts, and scheduling',
          'By providing a GUI interface',
          'By compiling user code'
        ],
        correctAnswer: 1,
        explanation: 'The kernel serves processes by orchestrating syscalls, handling interrupts, and managing scheduling to keep user tasks running.'
      },
      {
        id: 'ch1-q3',
        question: 'What characterizes the kernel\'s system of layers?',
        options: [
          'Physical, tangible, and direct',
          'Simple and flat with no hierarchy',
          'Virtual, mapped, isolated, and controlled',
          'User-accessible and modifiable'
        ],
        correctAnswer: 2,
        explanation: 'The kernel operates as a system of layers that are virtual, mapped, isolated, and controlled—providing structure at runtime.'
      }
    ];

    const ch3Questions: QuizQuestion[] = [
      {
        id: 'ch3-q1',
        question: 'What are the main physical memory zones in the Linux kernel?',
        options: [
          'User, Kernel, and Shared zones',
          'NUMA nodes, zones (DMA, Normal, High), pages, and PFNs',
          'RAM, ROM, and Cache zones',
          'Virtual and Physical zones only'
        ],
        correctAnswer: 1,
        explanation: 'Memory is organized into NUMA nodes, zones (DMA, Normal, High), pages, and PFNs (Page Frame Numbers).'
      },
      {
        id: 'ch3-q2',
        question: 'What is the memory lifecycle in the kernel?',
        options: [
          'Allocate → Use → Free',
          'Request → Allocate → Access → Own → Deallocate',
          'Map → Execute → Unmap',
          'Load → Process → Store'
        ],
        correctAnswer: 1,
        explanation: 'The lifecycle follows: Requestor → Allocator → Accessor → Owner → Deallocator, with clear responsibility at each stage.'
      },
      {
        id: 'ch3-q3',
        question: 'How does the kernel maintain isolation while sharing code?',
        options: [
          'Each process gets a full copy of kernel code',
          'Private stacks but shared code mappings',
          'No sharing at all',
          'Only user code is shared'
        ],
        correctAnswer: 1,
        explanation: 'The kernel uses private stacks for each process but maps shared kernel code, maintaining isolation while optimizing memory.'
      }
    ];

    const ch4Questions: QuizQuestion[] = [
      {
        id: 'ch4-q1',
        question: 'What function marks the transition from boot to kernel initialization?',
        options: [
          'main()',
          'kernel_init()',
          'start_kernel()',
          'boot_entry()'
        ],
        correctAnswer: 2,
        explanation: 'start_kernel() is the first C function called, marking where boot ends and kernel initialization begins.'
      },
      {
        id: 'ch4-q2',
        question: 'What types of code can execute in kernel context?',
        options: [
          'Only compiled kernel code',
          'vmlinuz, modules, eBPF programs, and live patches',
          'User programs only',
          'Just the initial ramdisk'
        ],
        correctAnswer: 1,
        explanation: 'The kernel can execute vmlinuz (core kernel), loadable modules, eBPF programs, and live patches.'
      },
      {
        id: 'ch4-q3',
        question: 'What happens when executing ./hello from userspace?',
        options: [
          'The kernel directly executes the binary',
          'ELF load, _start, dynamic linker, then main()',
          'The shell interprets the file',
          'main() executes immediately'
        ],
        correctAnswer: 1,
        explanation: 'The kernel loads the ELF, jumps to _start, the dynamic linker runs, and finally main() is called.'
      }
    ];

    const ch5Questions: QuizQuestion[] = [
      {
        id: 'ch5-q1',
        question: 'What are the main entry paths into the kernel?',
        options: [
          'Only system calls',
          'Syscalls (intentional), IRQs (asynchronous), and exceptions (faults)',
          'Function calls only',
          'Direct hardware jumps'
        ],
        correctAnswer: 1,
        explanation: 'The kernel is entered via syscalls (intentional), interrupts/IRQs (asynchronous), and exceptions/faults.'
      },
      {
        id: 'ch5-q2',
        question: 'In virtualization, what causes a VMEXIT?',
        options: [
          'Normal system calls',
          'Guest operations that require host intervention',
          'Memory allocations',
          'File I/O operations'
        ],
        correctAnswer: 1,
        explanation: 'VMEXIT occurs when guest operations need host enforcement, transitioning from guest to host context.'
      },
      {
        id: 'ch5-q3',
        question: 'How are syscall handlers organized?',
        options: [
          'All in one central file',
          'Distributed by architecture and subsystem',
          'Only in assembly files',
          'In userspace libraries'
        ],
        correctAnswer: 1,
        explanation: 'Syscall handling is distributed across architecture-specific entry code and subsystem implementations.'
      }
    ];

    const ch6Questions: QuizQuestion[] = [
      {
        id: 'ch6-q1',
        question: 'What is the relationship between CPU state and kernel state?',
        options: [
          'CPU maintains all state persistently',
          'CPU is stateless; kernel manages state',
          'They share state equally',
          'Kernel relies on CPU for state management'
        ],
        correctAnswer: 1,
        explanation: 'The CPU is stateless—the kernel manages execution state through task_struct, stacks, and scheduling.'
      },
      {
        id: 'ch6-q2',
        question: 'What is the interrupt handling strategy in Linux?',
        options: [
          'All work done in interrupt context',
          'Top-half minimalism with bottom-half deferral',
          'No interrupt handling',
          'Complete processing in hardware'
        ],
        correctAnswer: 1,
        explanation: 'Interrupts use top-half (minimal, fast) and bottom-half (deferred work) to balance responsiveness and throughput.'
      },
      {
        id: 'ch6-q3',
        question: 'What does synchronization in the kernel ensure?',
        options: [
          'Only mutual exclusion',
          'Visibility, lifetime, ordering—not just exclusion',
          'Just data integrity',
          'Only atomic operations'
        ],
        correctAnswer: 1,
        explanation: 'Kernel synchronization ensures visibility (memory ordering), lifetime (object existence), and ordering—beyond just mutual exclusion.'
      }
    ];

    const ch7Questions: QuizQuestion[] = [
      {
        id: 'ch7-q1',
        question: 'What mechanisms do kernel components use for internal communication?',
        options: [
          'Only function calls',
          'Wait queues, softirqs, and workqueues',
          'Network sockets',
          'Shared memory only'
        ],
        correctAnswer: 1,
        explanation: 'The kernel uses wait queues, softirqs, and workqueues for efficient internal communication and coordination.'
      },
      {
        id: 'ch7-q2',
        question: 'How do kernel modules interact with the core kernel?',
        options: [
          'Direct memory access',
          'Through exported symbols with defined boundaries',
          'Private APIs only',
          'Via system calls'
        ],
        correctAnswer: 1,
        explanation: 'Modules use exported symbols (EXPORT_SYMBOL) to interact with the kernel, defining clear API boundaries.'
      },
      {
        id: 'ch7-q3',
        question: 'What are the primary user-kernel communication interfaces?',
        options: [
          'Only libc functions',
          'Syscalls, /proc, ioctl, mmap, and eBPF',
          'Network protocols only',
          'Direct hardware access'
        ],
        correctAnswer: 1,
        explanation: 'Beyond libc, userspace communicates via syscalls, /proc, ioctl, mmap, and eBPF for different use cases.'
      }
    ];

    const ch8Questions: QuizQuestion[] = [
      {
        id: 'ch8-q1',
        question: 'What is the file I/O path through the kernel?',
        options: [
          'Direct disk access',
          'VFS → filesystem → block layer → driver',
          'Only through system cache',
          'Application → disk directly'
        ],
        correctAnswer: 1,
        explanation: 'File I/O flows through VFS (abstraction), filesystem implementation, block layer, and finally the driver.'
      },
      {
        id: 'ch8-q2',
        question: 'What is the CPU\'s role in I/O operations?',
        options: [
          'Moves all data itself',
          'Moves nothing—enables DMA and coordinates',
          'Only reads data',
          'Bypassed entirely'
        ],
        correctAnswer: 1,
        explanation: 'The CPU doesn\'t move data—it sets up DMA and coordinates I/O, letting hardware handle transfers.'
      },
      {
        id: 'ch8-q3',
        question: 'What is the evolution of event-driven I/O in Linux?',
        options: [
          'select only',
          'select/poll → epoll → io_uring',
          'Just blocking I/O',
          'No evolution needed'
        ],
        correctAnswer: 1,
        explanation: 'Event I/O evolved from select/poll (polling), to epoll (efficient events), to io_uring (async submission/completion).'
      },
      {
        id: 'ch8-q4',
        question: 'How does KVM implement virtualization?',
        options: [
          'Software emulation only',
          'VMX root/non-root modes with VirtIO',
          'Complete hardware simulation',
          'No hardware support needed'
        ],
        correctAnswer: 1,
        explanation: 'KVM uses VMX root (host) and non-root (guest) modes with VirtIO for efficient paravirtualized I/O.'
      }
    ];

    const ch9Questions: QuizQuestion[] = [
      {
        id: 'ch9-q1',
        question: 'Why is the kernel "always there"?',
        options: [
          'It runs as a background process',
          'Mapped, protected, entered on-demand',
          'Loaded into ROM',
          'Runs continuously on a separate CPU'
        ],
        correctAnswer: 1,
        explanation: 'The kernel is always mapped in memory, protected by CPU modes, and entered on-demand via syscalls/interrupts.'
      },
      {
        id: 'ch9-q2',
        question: 'Why does the kernel remain written in C?',
        options: [
          'Tradition only',
          'Control, determinism, and compile-time identity',
          'No other languages available',
          'It\'s easier to learn'
        ],
        correctAnswer: 1,
        explanation: 'C provides precise control over hardware, deterministic behavior, and compile-time configuration that matches kernel needs.'
      },
      {
        id: 'ch9-q3',
        question: 'What must align for correct kernel behavior?',
        options: [
          'Only memory addresses',
          'Intent, implementation, and runtime behavior',
          'Just code and comments',
          'Only data structures'
        ],
        correctAnswer: 1,
        explanation: 'Correct kernel operation requires alignment between intent (design), implementation (code), and behavior (runtime).'
      }
    ];

    const ch2Questions: QuizQuestion[] = [
      {
        id: 'ch2-q1',
        question: 'What architectural model does the Linux kernel primarily use?',
        options: [
          'Microkernel with separate services',
          'Monolithic but coordinated subsystems',
          'Hybrid kernel with mixed modules',
          'Exokernel with minimal abstraction'
        ],
        correctAnswer: 1,
        explanation: 'Linux uses a monolithic-but-coordinated model where subsystems are integrated but maintain modular organization.'
      },
      {
        id: 'ch2-q2',
        question: 'Which kernel object represents a running task or thread?',
        options: [
          'inode',
          'msg_queue',
          'task_struct',
          'dentry'
        ],
        correctAnswer: 2,
        explanation: 'task_struct is the fundamental kernel object that represents a process or thread, containing all execution state.'
      },
      {
        id: 'ch2-q3',
        question: 'What mechanism helps with concurrent data access without traditional locking?',
        options: [
          'Mutex locks',
          'Spinlocks only',
          'RCU (Read-Copy-Update)',
          'Binary semaphores'
        ],
        correctAnswer: 2,
        explanation: 'RCU (Read-Copy-Update) allows lock-free reads and deferred updates, providing efficient concurrency control.'
      },
      {
        id: 'ch2-q4',
        question: 'How does the kernel expose devices to userspace?',
        options: [
          'Direct hardware access only',
          'Through /dev using a class-based device model',
          'Via kernel recompilation',
          'Using only sysfs entries'
        ],
        correctAnswer: 1,
        explanation: 'The kernel uses a class-based device model to expose hardware through /dev nodes, providing a consistent interface.'
      }
    ];

    return [
    {
      id: 'ch1',
      title: 'Chapter 1 — Understanding Linux Kernel Before Code',
      body: (
        <div>
          <p>The kernel isn&apos;t a process—it&apos;s the system. It serves user processes, reacts to context, and enforces separation and control.</p>
          
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px', fontSize: '12px' }}>
            <strong>Why This Matters:</strong> Understanding that the kernel is not a process but the foundational layer of the operating system is crucial. Unlike user-space programs that start and stop, the kernel is always present, managing resources and providing services.
          </div>
          
          <ul style={{ marginTop: '12px' }}>
            <li><strong>The Kernel Is Not a Process</strong>: It&apos;s the always-present authority bridging hardware and software. When you run a program, it doesn&apos;t &quot;call&quot; the kernel as a separate process—instead, it enters kernel mode through system calls, interrupts, or exceptions.</li>
            <li><strong>Serving the Process</strong>: Orchestrates syscalls, interrupts, and scheduling to keep user tasks running. Every file operation, network request, or memory allocation goes through the kernel&apos;s coordination.</li>
            <li><strong>System of Layers</strong>: Virtual, mapped, isolated, and controlled—structure at runtime. The kernel creates abstractions (virtual memory, file systems) that hide hardware complexity from applications.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <p style={{ fontSize: '11px', color: 'var(--vscode-text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
              These files demonstrate core kernel concepts. Start with <code style={{ fontSize: '10px' }}>init/main.c</code> to see where the kernel begins, then explore <code style={{ fontSize: '10px' }}>kernel/fork.c</code> to understand process creation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { file: 'init/main.c', note: 'Kernel initialization entry point' },
                { file: 'kernel/fork.c', note: 'Process creation and cloning' },
                { file: 'include/linux/sched.h', note: 'Scheduler data structures' },
                { file: 'arch/x86/entry/entry_64.S', note: 'Low-level entry assembly code' }
              ].map(({ file, note }) => (
                <div key={file} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                    <button 
                      onClick={() => openFileInTab(file)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        border: '1px solid var(--vscode-button-border)',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      Open
                    </button>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--vscode-text-secondary)', opacity: 0.7, fontStyle: 'italic' }}>{note}</span>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch1"
            questions={ch1Questions}
            onComplete={(score, total) => markQuizComplete('ch1', score, total)}
            isCompleted={getChapterProgress('ch1').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch2',
      title: 'Chapter 2 — System Foundations',
      body: (
        <div>
          <p>Explore architecture, subsystems, and the monolithic-but-coordinated model.</p>
          
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px', fontSize: '12px' }}>
            <strong>Architecture Overview:</strong> Linux uses a monolithic kernel where all subsystems run in kernel space, but they&apos;re organized into well-defined modules. This provides performance benefits of a monolithic kernel while maintaining modularity through clear interfaces.
          </div>
          
          <ul style={{ marginTop: '12px' }}>
            <li><strong>Living Core</strong>: Modular, secure, interdependent subsystems. Each subsystem (memory, filesystem, networking) has clear responsibilities but must coordinate with others.</li>
            <li><strong>Subsystem Walkthrough</strong>: Directories reveal design. The kernel source tree structure mirrors the kernel architecture—each directory represents a major subsystem.</li>
            <li><strong>Kernel Objects</strong>: task_struct (processes), inode (files), msg_queue (IPC) shape behavior. These are the fundamental data structures that represent kernel abstractions.</li>
            <li><strong>Concurrency Safety</strong>: Locking and RCU (Read-Copy-Update) avoid conflicts. Multiple CPUs can access kernel data simultaneously, requiring careful synchronization.</li>
            <li><strong>Indirection</strong>: Per-thread references like <code style={{ fontSize: '10px' }}>current</code> allow the same code to work with different contexts. The <code style={{ fontSize: '10px' }}>current</code> macro points to the current process&apos;s task_struct.</li>
            <li><strong>Device Model</strong>: From buses to /dev via class-based exposure. Hardware is organized hierarchically: bus → device → driver → /dev node.</li>
            <li><strong>Configuration as Identity</strong>: Build-time defines role. Kernel features are compiled in or out, making each kernel build unique to its purpose.</li>
          </ul>
          
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px', fontSize: '12px' }}>
            <strong>How to Explore:</strong> Click on any directory below to expand it in the file tree. Each directory contains related source files that implement that subsystem. Start with <code style={{ fontSize: '10px' }}>kernel/</code> to see core functionality, then explore others based on your interests.
          </div>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { path: 'kernel/', description: 'Core kernel functionality: scheduling, process management, and system calls' },
                { path: 'mm/', description: 'Memory management: allocation, page tables, and virtual memory' },
                { path: 'fs/', description: 'Filesystem layer: VFS, inodes, and file operations' },
                { path: 'net/', description: 'Networking stack: protocols, sockets, and network interfaces' },
                { path: 'drivers/', description: 'Device drivers: hardware abstraction and device model' },
                { path: 'arch/x86/', description: 'x86 architecture-specific code: entry points and low-level operations' }
              ].map(item => (
                <div 
                  key={item.path} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '2px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => {
                    // Switch to explorer tab if not already there
                    if (activeSidebarTab !== 'explorer') {
                      setActiveSidebarTab('explorer');
                    }
                    openFileInTab(item.path);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px' }}>📁</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)', fontWeight: '500' }}>{item.path}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--vscode-text-secondary)', opacity: 0.8, lineHeight: '1.4', marginLeft: '20px' }}>{item.description}</span>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch2"
            questions={ch2Questions}
            onComplete={(score, total) => markQuizComplete('ch2', score, total)}
            isCompleted={getChapterProgress('ch2').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch3',
      title: 'Chapter 3 — Memory, Isolation, and Enforcement',
      body: (
        <div>
          <p>Memory as responsibility, layered physical reality, lifecycle roles, and enforcement boundaries.</p>
          <ul>
            <li><strong>Memory View</strong>: NUMA, zones, pages, PFNs.</li>
            <li><strong>Lifecycle</strong>: Requestor → allocator → accessor → owner → deallocator.</li>
            <li><strong>Shared Code, Separate State</strong>: Private stacks, shared code mapping.</li>
            <li><strong>Always There</strong>: Mapped, protected, context-entered.</li>
            <li><strong>Enforcement</strong>: Capabilities, namespaces, policy.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'mm/memory.c',
                'mm/mmap.c',
                'mm/page_alloc.c',
                'include/linux/mm_types.h',
                'kernel/capability.c',
                'security/'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch3"
            questions={ch3Questions}
            onComplete={(score, total) => markQuizComplete('ch3', score, total)}
            isCompleted={getChapterProgress('ch3').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch4',
      title: 'Chapter 4 — Boot, Init, and Entry',
      body: (
        <div>
          <p>From start_kernel() to modules and eBPF, what executes and when.</p>
          <ul>
            <li><strong>Where Boot Ends</strong>: Staged initialization to concurrency.</li>
            <li><strong>What Runs Inside</strong>: vmlinuz, modules, eBPF, live patches.</li>
            <li><strong>./hello</strong>: ELF load, _start, dynamic linker, main().</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'init/main.c',
                'arch/x86/boot/',
                'kernel/kthread.c',
                'fs/exec.c',
                'kernel/exit.c'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch4"
            questions={ch4Questions}
            onComplete={(score, total) => markQuizComplete('ch4', score, total)}
            isCompleted={getChapterProgress('ch4').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch5',
      title: 'Chapter 5 — Entering the Kernel',
      body: (
        <div>
          <p>Syscalls, interrupts, exceptions. Host vs guest with VMEXITs.</p>
          <ul>
            <li><strong>Entry Paths</strong>: Intentional (syscalls), asynchronous (IRQs), faults.</li>
            <li><strong>Virtualization</strong>: Guest illusions, host enforcement.</li>
            <li><strong>Syscall Handling</strong>: Distributed by architecture and subsystem.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'arch/x86/entry/syscalls/',
                'arch/x86/entry/entry_64.S',
                'kernel/signal.c',
                'arch/x86/kernel/traps.c',
                'kernel/irq/'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch5"
            questions={ch5Questions}
            onComplete={(score, total) => markQuizComplete('ch5', score, total)}
            isCompleted={getChapterProgress('ch5').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch6',
      title: 'Chapter 6 — Execution and Contexts',
      body: (
        <div>
          <p>Stateless CPU, kernel-managed state, layered behaviors, context-specific rules, interrupts by design.</p>
          <ul>
            <li><strong>Stateless CPU</strong> vs <strong>Stateful Kernel</strong>.</li>
            <li><strong>Layers</strong>: task_struct, stacks, scheduling, protection.</li>
            <li><strong>Execution Paths</strong>: Syscalls, IRQs, deferral.</li>
            <li><strong>Template for Tracing</strong>: Trigger → context → interface → owner.</li>
            <li><strong>Interrupts</strong>: Top-half minimalism, bottom-half deferral.</li>
            <li><strong>Logical vs Physical</strong>: Placement moves; meaning stays.</li>
            <li><strong>Synchronization</strong>: Visibility, lifetime, ordering, not just exclusion.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'kernel/sched/',
                'kernel/sched/core.c',
                'kernel/sched/fair.c',
                'kernel/softirq.c',
                'kernel/workqueue.c',
                'include/linux/preempt.h'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch6"
            questions={ch6Questions}
            onComplete={(score, total) => markQuizComplete('ch6', score, total)}
            isCompleted={getChapterProgress('ch6').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch7',
      title: 'Chapter 7 — Communication and Cooperation',
      body: (
        <div>
          <p>Internal comms tools, exported symbols, precise mappings across components, user/kernel interfaces.</p>
          <ul>
            <li><strong>Internal Tools</strong>: wait queues, softirqs, workqueues.</li>
            <li><strong>Modules</strong>: Exported symbols boundaries.</li>
            <li><strong>Bridging Components</strong>: Respect differences, map precisely.</li>
            <li><strong>Beyond libc</strong>: syscalls, /proc, ioctl, mmap, eBPF.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'kernel/module.c',
                'fs/proc/',
                'fs/sysfs/',
                'kernel/bpf/',
                'ipc/',
                'include/linux/export.h'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch7"
            questions={ch7Questions}
            onComplete={(score, total) => markQuizComplete('ch7', score, total)}
            isCompleted={getChapterProgress('ch7').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch8',
      title: 'Chapter 8 — Scheduling, I/O, and Virtualization',
      body: (
        <div>
          <p>From intent to I/O, CPU&apos;s role, time precision, epoll→io_uring, and KVM&apos;s model.</p>
          <ul>
            <li><strong>File I/O Path</strong>: VFS → filesystem → block layer → driver.</li>
            <li><strong>CPU and DMA</strong>: Moves nothing, enables everything.</li>
            <li><strong>Time</strong>: Precision and coherence.</li>
            <li><strong>Event I/O</strong>: select/poll → epoll → io_uring.</li>
            <li><strong>Virtualization</strong>: Multitasking vs VMs, KVM, VMX root/non-root, VirtIO.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-text-secondary)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'fs/read_write.c',
                'block/',
                'drivers/block/',
                'fs/select.c',
                'fs/eventpoll.c',
                'io_uring/',
                'arch/x86/kvm/',
                'drivers/vhost/'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch8"
            questions={ch8Questions}
            onComplete={(score, total) => markQuizComplete('ch8', score, total)}
            isCompleted={getChapterProgress('ch8').quizCompleted}
          />
        </div>
      )
    },
    {
      id: 'ch9',
      title: 'Chapter 9 — Concluding Insights',
      body: (
        <div>
          <p>Why the kernel is always present, the enduring structure beneath abstractions, and why C remains.</p>
          <ul>
            <li><strong>Always There</strong>: Mapped, protected, entered on demand.</li>
            <li><strong>Still Runs Through It</strong>: Execution, memory, I/O, control.</li>
            <li><strong>Why C</strong>: Control, determinism, compile-time identity.</li>
            <li><strong>Alignment</strong>: Intent, implementation, behavior.</li>
          </ul>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--vscode-bg-tertiary)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>📚 Study Files</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                'include/linux/syscalls.h',
                'kernel/sys.c',
                'mm/mlock.c',
                'kernel/time/',
                'Documentation/'
              ].map(file => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--vscode-text-secondary)' }}>{file}</span>
                  <button 
                    onClick={() => openFileInTab(file)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ChapterQuiz
            chapterId="ch9"
            questions={ch9Questions}
            onComplete={(score, total) => markQuizComplete('ch9', score, total)}
            isCompleted={getChapterProgress('ch9').quizCompleted}
          />
        </div>
      )
    }
  ];
  }, [openFileInTab, markQuizComplete, getChapterProgress, activeSidebarTab]);

  // Command palette commands - must be defined before conditional return
  const commandPaletteCommands = useMemo(() => [
    {
      id: 'open-file',
      label: 'Open File',
      icon: '📄',
      category: 'File',
      action: () => {
        // Focus on file tree or show file picker
        if (activeSidebarTab !== 'explorer') {
          setActiveSidebarTab('explorer');
        }
        setIsSidebarOpen(true);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      icon: '📁',
      category: 'View',
      action: () => {
        setIsSidebarOpen(!isSidebarOpen);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'toggle-panel',
      label: 'Toggle Guide Panel',
      icon: '📖',
      category: 'View',
      action: () => {
        setIsRightPanelOpen(!isRightPanelOpen);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'close-tab',
      label: 'Close Tab',
      icon: '✕',
      category: 'File',
      action: () => {
        if (activeTabId) {
          onTabClose(activeTabId);
        }
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'close-all-tabs',
      label: 'Close All Tabs',
      icon: '🗙',
      category: 'File',
      action: () => {
        setTabs([]);
        setActiveTabId(null);
        setSelectedFile('');
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'switch-explorer',
      label: 'Switch to Explorer',
      icon: '📁',
      category: 'View',
      action: () => {
        setActiveSidebarTab('explorer');
        setIsSidebarOpen(true);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'switch-data-structures',
      label: 'Switch to Data Structures',
      icon: '🔧',
      category: 'View',
      action: () => {
        setActiveSidebarTab('data-structures');
        setIsSidebarOpen(true);
        setIsCommandPaletteOpen(false);
      }
    }
  ], [activeSidebarTab, isSidebarOpen, isRightPanelOpen, activeTabId, onTabClose]);

  // Loading screen
  if (isInitialLoading) {
    return (
      <>
        <style>{`
          @keyframes vscode-loading-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.05);
              opacity: 0.9;
            }
          }
          
          @keyframes vscode-loading-progress {
            0% {
              transform: scaleX(0);
            }
            100% {
              transform: scaleX(1);
            }
          }
          
          .vscode-loading-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--vscode-editor-background, #1e1e1e);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            transition: opacity 0.5s ease-out;
          }
          
          .vscode-loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
          }
          
          .vscode-loading-icon {
            width: 80px;
            height: 80px;
            border-radius: 12px;
            background: linear-gradient(135deg, #007acc 0%, #005a9e 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            animation: vscode-loading-pulse 2s ease-in-out infinite;
            box-shadow: 0 4px 20px rgba(0, 122, 204, 0.3);
          }
          
          .vscode-loading-text {
            color: var(--vscode-foreground, #cccccc);
            font-size: 16px;
            font-weight: 500;
            opacity: 0.9;
          }
          
          .vscode-loading-progress-container {
            width: 200px;
            height: 3px;
            background-color: var(--vscode-progressBar-background, rgba(255, 255, 255, 0.1));
            border-radius: 2px;
            overflow: hidden;
          }
          
          .vscode-loading-progress-bar {
            width: 100%;
            height: 100%;
            background-color: var(--vscode-progressBar-foreground, #007acc);
            border-radius: 2px;
            animation: vscode-loading-progress 2s ease-in-out forwards;
            transform-origin: left;
          }
        `}</style>
        <div className="vscode-loading-container">
          <div className="vscode-loading-content">
            {/* Animated Logo/Icon */}
            <div className="vscode-loading-icon">
              🐧
            </div>
            
            {/* Loading Text */}
            <div className="vscode-loading-text">
              Loading Explorer...
            </div>
            
            {/* Progress Bar */}
            <div className="vscode-loading-progress-container">
              <div className="vscode-loading-progress-bar" />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="vscode-container">
      {/* Mobile Toggle Buttons */}
      <button
        className="vscode-sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? '✕' : '☰'}
      </button>
      <button
        className="vscode-panel-toggle"
        onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
        aria-label="Toggle guide panel"
      >
        {isRightPanelOpen ? '✕' : '📖'}
      </button>
      
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandPaletteCommands}
      />
      
      {/* Main VSCode Layout */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Activity Bar */}
        {!isMobile && (
          <ActivityBar
            activeView={activeSidebarTab}
            onViewChange={(view) => {
              setActiveSidebarTab(view);
              setIsSidebarOpen(true);
            }}
          />
        )}
        
        {/* Sidebar */}
        <div 
          className={`vscode-sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}
          suppressHydrationWarning
          style={{ width: `${sidebarWidth}px`, minWidth: '180px', maxWidth: '40vw' }}
          onClick={(e) => {
            // Close sidebar on mobile when clicking outside (on overlay)
            if (isMobile && e.currentTarget === e.target) {
              setIsSidebarOpen(false);
            }
          }}
        >
          {isMobile && (
            <div className="vscode-sidebar-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px' }}>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--vscode-text-secondary)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: '16px'
                  }}
                  aria-label="Close sidebar"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <div className="vscode-sidebar-content">
            {activeSidebarTab === 'explorer' && (
              <div className="sidebar-view">
                <FileTree
                  onFileSelect={openFileInTab}
                  selectedFile={selectedFile}
                  listDirectory={buildFileTree}
                  titleLabel={repoLabel}
                  refreshKey={treeRefreshKey}
                  expandDirectoryRequest={directoryExpandRequest}
                  onDirectoryExpand={(path: string) => {
                    // Switch to explorer tab if not already there
                    if (activeSidebarTab !== 'explorer') {
                      setActiveSidebarTab('explorer');
                    }
                    setSelectedFile(path);
                  }}
                />
              </div>
            )}
            
            {activeSidebarTab === 'data-structures' && (
              <div className="sidebar-view">
                <DataStructuresView 
                  onFileOpen={(filePath, structName) => {
                    openFileInTab(filePath, structName);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={() => handleMouseDown('sidebar')}
          suppressHydrationWarning
          style={{
            width: '4px',
            backgroundColor: isResizing === 'sidebar' ? 'var(--vscode-text-accent)' : 'transparent',
            cursor: 'col-resize',
            borderRight: '1px solid var(--vscode-border)',
            transition: 'background-color 0.2s'
          }}
        />

        {/* Editor Container */}
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
          {activeTab && (
            <Breadcrumbs
              path={activeTab.path}
              onPathClick={(path) => {
                // If it's a directory, expand it
                if (path.endsWith('/') || path !== activeTab.path) {
                  openFileInTab(path);
                }
              }}
            />
          )}
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
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Start exploring the Linux kernel source code</div>
              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '8px' }}>
                Press <kbd style={{ padding: '2px 6px', background: 'var(--vscode-bg-tertiary)', borderRadius: '3px' }}>Cmd/Ctrl + P</kbd> to open command palette
              </div>
            </div>
          )}
        </div>

        {/* Right Panel Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={() => handleMouseDown('rightPanel')}
          suppressHydrationWarning
          style={{
            width: '4px',
            backgroundColor: isResizing === 'rightPanel' ? 'var(--vscode-text-accent)' : 'transparent',
            cursor: 'col-resize',
            borderLeft: '1px solid var(--vscode-border)',
            transition: 'background-color 0.2s'
          }}
        />

        {/* Right Panel */}
        <div 
          className={`vscode-panel ${isRightPanelOpen ? 'mobile-open' : ''}`}
          suppressHydrationWarning
          style={{ width: `${rightPanelWidth}px`, minWidth: '200px', maxWidth: '40vw' }}
          onClick={(e) => {
            // Close panel on mobile when clicking outside (on overlay)
            if ((isMobile || isTablet) && e.currentTarget === e.target) {
              setIsRightPanelOpen(false);
            }
          }}
        >
          <div className="vscode-panel-header">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <span style={{ color: 'var(--vscode-foreground)', fontWeight: 'bold' }}>📖 Guide</span>
              <span style={{ fontSize: '11px', color: 'var(--vscode-text-secondary)', opacity: 0.7 }}>
                Based on{' '}
                <a 
                  href="https://www.linkedin.com/posts/moon-hee-lee_the-kernel-in-the-mind-v112025-activity-7334420081403146240--Yp2/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: 'var(--vscode-text-link-foreground)', 
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--vscode-text-link-foreground)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  &quot;The Kernel in The Mind&quot;
                </a>
                {' '}by Moon Hee Lee 🧠
              </span>
              </div>
              {(isMobile || isTablet) && (
                <button
                  onClick={() => setIsRightPanelOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--vscode-text-secondary)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: '16px'
                  }}
                  aria-label="Close panel"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          <div className="vscode-panel-content">
            <GuidePanel 
              sections={guideSections} 
              defaultOpenIds={["ch1"]}
              overallProgress={progress.overallProgress}
              chapterProgress={Object.fromEntries(
                Object.entries(progress.chapters).map(([id, ch]) => [id, ch.quizCompleted])
              )}
            />
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
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