'use client';
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FileTree from '@/components/FileTree';
import TabBar from '@/components/TabBar';
import CodeEditorContainer from '@/components/CodeEditorContainer';
import GuidePanel from '@/components/GuidePanel';
import DataStructuresView from '@/components/DataStructuresView';
import ActivityBar from '@/components/ActivityBar';
import StatusBar from '@/components/StatusBar';
import { EditorTab } from '@/types';
import {
  buildFileTree,
  fetchFileContent,
  getCurrentRepoLabel,
  setGitHubRepoWithDefaultBranch,
  getRepoIdentifier,
} from '@/lib/github-api';
import { getProjectConfig, createGenericGuide } from '@/lib/project-guides';
import { createLinuxKernelGuide } from '@/lib/guides/linux-kernel';
import { createLLVMGuide } from '@/lib/guides/llvm';
import { createGlibcGuide } from '@/lib/guides/glibc';
import { createCPythonGuide } from '@/lib/guides/cpython';
import LoadingScreen from '@/components/LoadingScreen';
import { useRepository } from '@/contexts/RepositoryContext';
import {
  repositoryExists,
  getGitHubRepoIdentifier,
  getDirectoryMetadata,
  hasTreeStructure,
} from '@/lib/repo-storage';
import { downloadDirectoryContents } from '@/lib/github-archive';
import '@/app/vscode.css';

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

// Helper function to get repository-scoped localStorage key
const getRepoScopedKey = (baseKey: string, repoIdentifier: string | null): string => {
  if (!repoIdentifier) {
    return baseKey; // Fallback to non-scoped key if no repository
  }
  return `${baseKey}-${repoIdentifier}`;
};

interface KernelExplorerProps {
  owner?: string;
  repo?: string;
  branch?: string;
}

export default function KernelExplorer({ owner, repo, branch }: KernelExplorerProps) {
  const router = useRouter();
  const githubUrlRef = useRef<HTMLInputElement>(null);
  const {
    setRepository,
    switchBranch,
    currentBranch,
    isLoading: repoLoading,
    error: repoError,
    downloadProgress,
    identifier: repoIdentifier,
  } = useRepository();

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [directoryExpandRequest, setDirectoryExpandRequest] = useState<{
    path: string;
    id: number;
  } | null>(null);
  // Initialize with consistent values for SSR (will be updated after hydration)
  const [repoLabel, setRepoLabel] = useState<string>('torvalds/linux');

  // Kernel version state - use v6.1 for Linux kernel, otherwise use provided branch
  const [selectedVersion, setSelectedVersion] = useState<string>(() => {
    if (owner === 'torvalds' && repo === 'linux') {
      return branch || 'v6.1';
    }
    return branch || 'v6.1';
  });

  // Get project config
  const projectConfig = useMemo(() => {
    if (owner && repo) {
      return getProjectConfig(owner, repo);
    }
    return getProjectConfig('torvalds', 'linux'); // Default fallback
  }, [owner, repo]);

  // Panel width state - start with defaults to avoid hydration mismatch
  const [sidebarWidth, setSidebarWidth] = useState<number>(220);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Sidebar tab state
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'data-structures'>(
    'explorer'
  );

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
  // Mobile view state: 'explorer' | 'editor' | 'guide'
  const [mobileView, setMobileView] = useState<'explorer' | 'editor' | 'guide'>('editor');

  // Initial loading state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  // Tree structure readiness state
  const [isTreeStructureReady, setIsTreeStructureReady] = useState<boolean>(false);
  // Refs for cleanup
  const treeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const treeCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if mobile on mount and resize
  // Using 1024px as breakpoint for "small laptop" - below this is mobile/tablet
  useEffect(() => {
    const checkViewport = () => {
      if (typeof window !== 'undefined') {
        const isMobileView = window.innerWidth < 1024;
        setIsMobile(isMobileView);
        // On mobile, ensure only one panel is visible at a time
        if (isMobileView) {
          if (mobileView === 'explorer') {
            setIsSidebarOpen(true);
            setIsRightPanelOpen(false);
          } else if (mobileView === 'guide') {
            setIsSidebarOpen(false);
            setIsRightPanelOpen(true);
          } else {
            setIsSidebarOpen(false);
            setIsRightPanelOpen(false);
          }
        } else {
          // Desktop: show all panels
          setIsSidebarOpen(true);
          setIsRightPanelOpen(true);
        }
      }
    };
    checkViewport();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkViewport);
      return () => window.removeEventListener('resize', checkViewport);
    }
  }, [mobileView]);

  // Initial loading animation - 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Check repository setup and tree structure readiness
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkRepositorySetup = async () => {
      if (!owner || !repo) {
        // No repository specified in URL, redirect to main page
        router.push('/');
        return;
      }

      try {
        // Check if repository exists locally
        const identifier = getRepoIdentifier(owner, repo);
        const exists = await repositoryExists('github', identifier);

        if (!exists) {
          // Repository not found locally, redirect to main page
          router.push('/');
          return;
        }

        // Repository exists, set it in context
        await setRepository('github', identifier, `${owner}/${repo}`);

        // Set GitHub API config for backward compatibility
        const defaultBranch = owner === 'torvalds' && repo === 'linux' ? 'v6.1' : branch || 'v6.1';
        await setGitHubRepoWithDefaultBranch(owner, repo, branch || defaultBranch);
        setRepoLabel(`${owner}/${repo}`);

        // Switch to requested branch if specified and different from current
        let branchToUse = defaultBranch;
        if (branch && branch !== currentBranch) {
          try {
            await switchBranch(branch);
            setSelectedVersion(branch);
            branchToUse = branch;
          } catch (error) {
            console.warn('Failed to switch to requested branch:', error);
            // Use current branch instead
            branchToUse = currentBranch || defaultBranch;
            setSelectedVersion(branchToUse);
          }
        } else {
          branchToUse = currentBranch || defaultBranch;
          setSelectedVersion(branchToUse);
        }

        // Check if tree structure exists for the current branch
        const treeExists = await hasTreeStructure('github', identifier, branchToUse);
        setIsTreeStructureReady(treeExists);

        // If tree structure doesn't exist, wait for download to complete
        if (!treeExists) {
          // Clear any existing intervals
          if (treeCheckIntervalRef.current) {
            clearInterval(treeCheckIntervalRef.current);
            treeCheckIntervalRef.current = null;
          }
          if (treeCheckTimeoutRef.current) {
            clearTimeout(treeCheckTimeoutRef.current);
            treeCheckTimeoutRef.current = null;
          }

          // Poll for tree structure to become available (download is in progress)
          treeCheckIntervalRef.current = setInterval(async () => {
            const treeReady = await hasTreeStructure('github', identifier, branchToUse);
            if (treeReady) {
              setIsTreeStructureReady(true);
              if (treeCheckIntervalRef.current) {
                clearInterval(treeCheckIntervalRef.current);
                treeCheckIntervalRef.current = null;
              }
              if (treeCheckTimeoutRef.current) {
                clearTimeout(treeCheckTimeoutRef.current);
                treeCheckTimeoutRef.current = null;
              }
            }
          }, 500); // Check every 500ms

          // Cleanup interval after 5 minutes (timeout)
          treeCheckTimeoutRef.current = setTimeout(
            () => {
              if (treeCheckIntervalRef.current) {
                clearInterval(treeCheckIntervalRef.current);
                treeCheckIntervalRef.current = null;
              }
            },
            5 * 60 * 1000
          );
        }
      } catch (error) {
        console.error('Failed to setup repository:', error);
        // Redirect to home on error
        router.push('/');
      }
    };

    checkRepositorySetup();

    // Cleanup function - runs when component unmounts or dependencies change
    return () => {
      if (treeCheckIntervalRef.current) {
        clearInterval(treeCheckIntervalRef.current);
        treeCheckIntervalRef.current = null;
      }
      if (treeCheckTimeoutRef.current) {
        clearTimeout(treeCheckTimeoutRef.current);
        treeCheckTimeoutRef.current = null;
      }
    };
  }, [owner, repo, branch, router, setRepository, switchBranch, currentBranch]);

  // Load saved state after hydration to avoid SSR mismatch
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setIsHydrated(true);
      setRepoLabel(getCurrentRepoLabel());
    }, 0);

    if (typeof window !== 'undefined') {
      // Restore panel widths (these are global, not repository-specific)
      const savedSidebarWidth = localStorage.getItem('kernel-explorer-sidebar-width');
      const savedRightPanelWidth = localStorage.getItem('kernel-explorer-right-panel-width');

      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        if (savedSidebarWidth) {
          setSidebarWidth(parseInt(savedSidebarWidth, 10));
        }
        if (savedRightPanelWidth) {
          setRightPanelWidth(parseInt(savedRightPanelWidth, 10));
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

  // Load repository-specific tabs when repository changes
  useEffect(() => {
    if (!isHydrated || !repoIdentifier) {
      // Clear tabs if no repository is set
      if (!repoIdentifier) {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setTabs([]);
          setActiveTabId(null);
          setSelectedFile('');
        }, 0);
      }
      return;
    }

    // Load tabs for this specific repository
    const tabsKey = getRepoScopedKey('kernel-explorer-tabs', repoIdentifier);
    const activeTabKey = getRepoScopedKey('kernel-explorer-active-tab', repoIdentifier);
    const selectedFileKey = getRepoScopedKey('kernel-explorer-selected-file', repoIdentifier);

    const savedTabs = loadFromLocalStorage(tabsKey, []) as EditorTab[];
    const savedActiveTabId = loadFromLocalStorage(activeTabKey, null) as string | null;
    const savedSelectedFile = loadFromLocalStorage(selectedFileKey, '') as string;

    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      if (savedTabs.length > 0) {
        setTabs(savedTabs);
      } else {
        setTabs([]);
      }
      if (savedActiveTabId) {
        setActiveTabId(savedActiveTabId);
      } else {
        setActiveTabId(null);
      }
      if (savedSelectedFile) {
        setSelectedFile(savedSelectedFile);
      } else {
        setSelectedFile('');
      }
    }, 0);
  }, [repoIdentifier, isHydrated]);

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
    if (isHydrated && repoIdentifier) {
      const tabsKey = getRepoScopedKey('kernel-explorer-tabs', repoIdentifier);
      saveToLocalStorage(tabsKey, tabs);
    }
  }, [tabs, isHydrated, repoIdentifier]);

  useEffect(() => {
    if (isHydrated && repoIdentifier) {
      const activeTabKey = getRepoScopedKey('kernel-explorer-active-tab', repoIdentifier);
      saveToLocalStorage(activeTabKey, activeTabId);
    }
  }, [activeTabId, isHydrated, repoIdentifier]);

  useEffect(() => {
    if (isHydrated && repoIdentifier) {
      const selectedFileKey = getRepoScopedKey('kernel-explorer-selected-file', repoIdentifier);
      saveToLocalStorage(selectedFileKey, selectedFile);
    }
  }, [selectedFile, isHydrated, repoIdentifier]);

  useEffect(() => {
    if (isHydrated && repoIdentifier) {
      const selectedVersionKey = getRepoScopedKey(
        'kernel-explorer-selected-version',
        repoIdentifier
      );
      saveToLocalStorage(selectedVersionKey, selectedVersion);
    }
  }, [selectedVersion, isHydrated, repoIdentifier]);

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
    (filePath: string, searchPattern?: string, scrollToLine?: number) => {
      let normalizedPath = filePath.replace(/\/+$/, '');

      // Check if this is a Documentation folder - open index.rst instead
      if (filePath.startsWith('Documentation/') && filePath.endsWith('/')) {
        normalizedPath = `${normalizedPath}/index.rst`;
        // Continue to open the file instead of expanding directory
      } else if (filePath.endsWith('/')) {
        // For other directories, check if downloaded and download if needed, then expand
        if (activeSidebarTab !== 'explorer') {
          setActiveSidebarTab('explorer');
        }
        setSelectedFile(normalizedPath);

        // Check if directory metadata exists, download if needed
        const handleDirectoryExpand = async () => {
          try {
            const identifier = getGitHubRepoIdentifier(owner || 'torvalds', repo || 'linux');
            const branchToUse = currentBranch || branch || 'v6.1';

            // Check if directory metadata exists
            const metadata = await getDirectoryMetadata(
              'github',
              identifier,
              branchToUse,
              normalizedPath
            );

            // If metadata doesn't exist, download the directory contents first
            if (!metadata || metadata.length === 0) {
              await downloadDirectoryContents(
                owner || 'torvalds',
                repo || 'linux',
                branchToUse,
                normalizedPath
              );
            }

            // Now expand the directory
            setDirectoryExpandRequest({ path: normalizedPath, id: Date.now() });
          } catch (error) {
            console.error('Failed to download directory:', error);
            // Still try to expand even if download fails (might work from cache)
            setDirectoryExpandRequest({ path: normalizedPath, id: Date.now() });
          }
        };

        handleDirectoryExpand();
        return;
      }

      // For files: expand all parent directories recursively to make the file visible
      if (activeSidebarTab !== 'explorer') {
        setActiveSidebarTab('explorer');
      }

      // Extract the parent directory path from the file path
      const pathParts = normalizedPath.split('/');
      if (pathParts.length > 1) {
        // File is in a subdirectory - expand the parent directory
        const parentDirPath = pathParts.slice(0, -1).join('/');
        setDirectoryExpandRequest({ path: parentDirPath, id: Date.now() });
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
            scrollToLine: t.id === existing.id ? scrollToLine : t.scrollToLine,
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
        scrollToLine: scrollToLine,
      };
      setTabs((prev) => [...prev.map((t) => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(newTab.id);
    },
    [tabs, activeSidebarTab, owner, repo, currentBranch, branch]
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
        }
        return nextTabs;
      });
    },
    [activeTabId]
  );

  const onEditorContentLoad = useCallback(
    (content: string) => {
      if (!activeTab) return;
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false, content } : t))
      );

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

  // Track if we're currently refreshing to prevent loops

  // Guide content - dynamically loaded based on project
  const guideSections = useMemo(() => {
    if (!projectConfig) {
      // No project config - use generic guide
      return createGenericGuide(owner || 'torvalds', repo || 'linux');
    }

    // Load guide based on project type
    if (projectConfig.id === 'linux-kernel') {
      return createLinuxKernelGuide(openFileInTab);
    } else if (projectConfig.id === 'llvm') {
      return createLLVMGuide(openFileInTab);
    } else if (projectConfig.id === 'glibc') {
      return createGlibcGuide(openFileInTab);
    } else if (projectConfig.id === 'cpython') {
      return createCPythonGuide(openFileInTab);
    }

    // Project config exists but no specific guide - use generic guide
    return createGenericGuide(projectConfig.owner, projectConfig.repo);
  }, [projectConfig, owner, repo, openFileInTab]);

  // Command palette commands
  // Loading screen
  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  // Repository loading, download progress, or tree structure not ready
  if (repoLoading || downloadProgress || !isTreeStructureReady) {
    return (
      <div className="min-h-screen bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] flex items-center justify-center">
        <div className="text-center max-w-md">
          {downloadProgress ? (
            <>
              <div className="text-lg mb-4">Downloading Repository Structure</div>
              <div className="w-full bg-[var(--vscode-progressBar-background)] rounded-full h-2 mb-4">
                <div
                  className="bg-[var(--vscode-progressBar-foreground)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress.progress}%` }}
                />
              </div>
              <div className="text-sm opacity-70 mb-2">{downloadProgress.message}</div>
              {downloadProgress.phase === 'downloading' &&
                downloadProgress.filesProcessed &&
                downloadProgress.totalFiles && (
                  <div className="text-xs opacity-50">
                    Processing {downloadProgress.filesProcessed} / {downloadProgress.totalFiles}{' '}
                    items
                  </div>
                )}
            </>
          ) : (
            <>
              <div className="text-lg mb-2">
                {isTreeStructureReady
                  ? 'Setting up repository...'
                  : 'Loading repository structure...'}
              </div>
              <div className="text-sm opacity-70">Please wait</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Repository error
  if (repoError) {
    return (
      <div className="min-h-screen bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-lg mb-4 text-[var(--vscode-errorForeground)]">Repository Error</div>
          <div className="text-sm mb-4 opacity-70">{repoError}</div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] rounded text-sm"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vscode-container">
      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <div
          className={`vscode-sidebar ${isSidebarOpen && (isMobile ? mobileView === 'explorer' : true) ? 'mobile-open' : ''} ${isMobile && mobileView !== 'explorer' ? 'mobile-hidden' : ''}`}
          suppressHydrationWarning
          style={{ width: `${sidebarWidth}px`, minWidth: '180px', maxWidth: '40vw' }}
        >
          {!isMobile && (
            <ActivityBar
              activeView={activeSidebarTab}
              onViewChange={(view) => {
                setActiveSidebarTab(view);
                setIsSidebarOpen(true);
              }}
            />
          )}
          {isMobile && (
            <div
              style={{
                padding: '12px',
                borderBottom: '1px solid var(--vscode-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Explorer</h3>
              <button
                onClick={() => setMobileView('editor')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-text-primary)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '18px',
                }}
                aria-label="Close explorer"
              >
                ✕
              </button>
            </div>
          )}
          <div className="vscode-sidebar-content">
            {activeSidebarTab === 'explorer' && (
              <FileTree
                onFileSelect={(filePath: string) => {
                  openFileInTab(filePath);
                  // On mobile, switch to editor view when file is selected
                  if (isMobile) {
                    setMobileView('editor');
                  }
                }}
                selectedFile={selectedFile}
                listDirectory={buildFileTree}
                titleLabel={repoLabel}
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
                onFileOpen={(filePath, structName, lineNumber) => {
                  // If we have a line number, use it for precise scrolling
                  // Otherwise, use struct name as search pattern
                  openFileInTab(filePath, lineNumber ? undefined : structName, lineNumber);
                  // On mobile, switch to editor view when file is opened
                  if (isMobile) {
                    setMobileView('editor');
                  }
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
          className={`vscode-editor-container ${isMobile && mobileView !== 'editor' ? 'mobile-hidden' : ''}`}
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
          className={`vscode-panel ${isRightPanelOpen && (isMobile ? mobileView === 'guide' : true) ? 'mobile-open' : ''} ${isMobile && mobileView !== 'guide' ? 'mobile-hidden' : ''}`}
          suppressHydrationWarning
          style={{
            width: `${rightPanelWidth}px`,
            minWidth: '200px',
            maxWidth: '40vw',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {isMobile && (
            <div
              style={{
                padding: '12px',
                borderBottom: '1px solid var(--vscode-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Guide</h3>
              <button
                onClick={() => setMobileView('editor')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-text-primary)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '18px',
                }}
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>
          )}
          <div
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <GuidePanel
              sections={guideSections}
              defaultOpenIds={
                projectConfig?.guides?.[0]?.defaultOpenIds ||
                (guideSections.length > 0 ? [guideSections[0].id] : [])
              }
            />
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      {isMobile && (
        <div
          className="mobile-nav-bar"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '56px',
            background: 'var(--vscode-bg-secondary)',
            borderTop: '1px solid var(--vscode-border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: 1000,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <button
            onClick={() => setMobileView('explorer')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color:
                mobileView === 'explorer'
                  ? 'var(--vscode-text-accent)'
                  : 'var(--vscode-text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '12px',
              transition: 'color 0.2s',
            }}
            aria-label="Explorer"
          >
            <span style={{ fontSize: '20px' }}>📁</span>
            <span>Explorer</span>
          </button>
          <button
            onClick={() => setMobileView('editor')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color:
                mobileView === 'editor'
                  ? 'var(--vscode-text-accent)'
                  : 'var(--vscode-text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '12px',
              transition: 'color 0.2s',
            }}
            aria-label="Editor"
          >
            <span style={{ fontSize: '20px' }}>📝</span>
            <span>Editor</span>
          </button>
          <button
            onClick={() => setMobileView('guide')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color:
                mobileView === 'guide'
                  ? 'var(--vscode-text-accent)'
                  : 'var(--vscode-text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '12px',
              transition: 'color 0.2s',
            }}
            aria-label="Guide"
          >
            <span style={{ fontSize: '20px' }}>📚</span>
            <span>Guide</span>
          </button>
        </div>
      )}

      <StatusBar
        filePath={activeTab?.path}
        line={editorLine}
        column={editorColumn}
        language={editorLanguage}
        lineCount={editorLineCount}
        fileSize={editorFileSize}
        repoLabel={repoLabel}
        branch={currentBranch || selectedVersion}
      />
    </div>
  );
}
