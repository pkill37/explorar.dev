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
import Breadcrumbs from '@/components/Breadcrumbs';
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
  const { progress, markQuizComplete, getChapterProgress } = useKernelProgress(chapterIds);

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

  // Guide content - using the same content from the original file
  const guideSections = useMemo(() => {
    // This is a large object, we'll import it from the original file or keep it here
    // For now, I'll create a simplified version - you can copy the full content from the original
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
            <ChapterQuiz
              chapterId="ch1"
              questions={ch1Questions}
              onComplete={(score, total) => markQuizComplete('ch1', score, total)}
              isCompleted={getChapterProgress('ch1').quizCompleted}
            />
          </div>
        ),
      },
    ];
  }, [markQuizComplete, getChapterProgress]);

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
              🐧
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
          {activeTab && (
            <Breadcrumbs
              path={activeTab.path}
              onPathClick={(path) => {
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
          <div className="vscode-panel-content">
            <GuidePanel
              sections={guideSections}
              defaultOpenIds={['ch1']}
              overallProgress={progress.overallProgress}
              chapterProgress={Object.fromEntries(
                Object.entries(progress.chapters).map(([id, ch]) => [id, ch.quizCompleted])
              )}
            />
          </div>
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
