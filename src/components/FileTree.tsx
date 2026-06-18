'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '@/types';
import {
  buildFileTree,
  getFileIcon,
  GitHubApiError,
  sortFileNodes,
  getCurrentRepoLabel,
  getCurrentBranch,
  getTrustedVersion,
} from '@/lib/github-api';
import { type FileSourceMode } from '@/lib/curated-content-url';
import { useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';
import { getTreeStructure, getGitHubRepoIdentifier } from '@/lib/repo-storage';

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  listDirectory?: (path: string) => Promise<FileNode[]>;
  titleLabel?: string;
  sourceMode?: FileSourceMode;
  onSourceModeChange?: (mode: FileSourceMode) => void;
  onDirectoryExpand?: (path: string) => void;
  expandDirectoryRequest?: { path: string; id: number } | null;
}

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  listDirectory?: (path: string) => Promise<FileNode[]>;
  onDirectoryExpand?: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string, isExpanded: boolean) => void;
}

function inferRefKind(repoLabel: string | null, ref: string): 'commit' | 'tag' | 'branch' {
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    return 'commit';
  }

  if (repoLabel) {
    const [owner, repo] = repoLabel.split('/');
    if (owner && repo && getTrustedVersion(owner, repo) === ref) {
      return 'tag';
    }
  }

  return 'branch';
}

function formatDisplayRef(ref: string, refKind: 'commit' | 'tag' | 'branch'): string {
  if (refKind !== 'commit') {
    return ref;
  }

  return ref.length > 12 ? `${ref.slice(0, 12)}…` : ref;
}

const SourceModeGearIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    style={{ width: '12px', height: '12px', display: 'block' }}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3.25" />
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.2.7.6.9h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.7Z" />
  </svg>
);

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  level,
  onFileSelect,
  selectedFile,
  listDirectory,
  onDirectoryExpand,
  expandedPaths,
  onToggleExpand,
}) => {
  // Use centralized expandedPaths state instead of local state
  const normalizedPath = node.path.replace(/\/+$/, '');
  const isExpanded = expandedPaths.has(normalizedPath);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [isLoading, setIsLoading] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChildren(node.children || []);
  }, [node.children]);

  const handleToggle = async () => {
    if (node.type === 'file') {
      // File clicked - select it and notify parent
      onFileSelect(node.path);
      return;
    }

    // Directory clicked - toggle expansion
    const newExpandedState = !isExpanded;

    // Load directory contents if not already loaded
    if (newExpandedState && !node.isLoaded) {
      setIsLoading(true);
      try {
        const childNodes = listDirectory
          ? await listDirectory(node.path)
          : await buildFileTree(node.path);
        setChildren(childNodes);
        node.children = childNodes;
        node.isLoaded = true;
        if (onDirectoryExpand) {
          onDirectoryExpand(node.path);
        }
      } catch (error) {
        console.error('Failed to load directory:', error);
        // Don't expand if loading failed
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // Update centralized expansion state
    onToggleExpand(normalizedPath, newExpandedState);
    node.isExpanded = newExpandedState;
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggle();
  };

  // Normalize paths for comparison (remove trailing slashes)
  const normalizePath = (path: string) => path.replace(/\/+$/, '');
  const selectedPath = normalizePath(selectedFile || '');
  const currentPath = normalizePath(node.path);
  const isSelected =
    !!selectedPath && (currentPath === selectedPath || currentPath.startsWith(`${selectedPath}/`));

  return (
    <div>
      <div
        ref={itemRef}
        data-file-path={node.path}
        className={`vscode-file-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleToggle}
      >
        <span
          className="icon"
          onClick={handleIconClick}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            display: 'inline-block',
            minWidth: '16px',
          }}
          title={
            node.type === 'directory'
              ? isExpanded
                ? 'Collapse directory'
                : 'Expand directory'
              : 'Open file'
          }
        >
          {isLoading ? (
            <div className="vscode-spinner" style={{ width: '12px', height: '12px' }} />
          ) : (
            getFileIcon({ ...node, isExpanded })
          )}
        </span>
        <span className="name">{node.name}</span>
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {sortFileNodes(children).map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              listDirectory={listDirectory}
              onDirectoryExpand={onDirectoryExpand}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({
  onFileSelect,
  selectedFile,
  listDirectory,
  titleLabel,
  sourceMode,
  onSourceModeChange,
  onDirectoryExpand,
  expandDirectoryRequest,
}) => {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [completeTree, setCompleteTree] = useState<FileNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track expanded paths in centralized state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const handledRequestRef = useRef<number | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const { setRateLimit } = useGitHubRateLimit();
  const currentRepoLabel = getCurrentRepoLabel();
  const currentRef = getCurrentBranch();
  const currentRefKind = inferRefKind(currentRepoLabel, currentRef);
  const currentRefLabel = formatDisplayRef(currentRef, currentRefKind);

  useEffect(() => {
    if (!isSourceMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!sourceMenuRef.current?.contains(event.target as Node)) {
        setIsSourceMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSourceMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSourceMenuOpen]);

  // Handler to toggle directory expansion
  const handleToggleExpand = useCallback((path: string, isExpanded: boolean) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      const normalizedPath = path.replace(/\/+$/, '');
      if (isExpanded) {
        newSet.add(normalizedPath);
      } else {
        newSet.delete(normalizedPath);
      }
      return newSet;
    });
  }, []);

  // Helper function to mark all directories as loaded
  const markDirectoriesAsLoaded = useCallback((nodes: FileNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'directory') {
        node.isLoaded = true; // We have the complete structure
      }
      if (node.children) {
        markDirectoriesAsLoaded(node.children);
      }
    }
  }, []);

  // Helper function to find node in tree by path
  const findNodeInTree = useCallback((tree: FileNode[], path: string): FileNode | null => {
    if (!path) return null;

    // Normalize path for comparison (remove trailing slashes)
    const normalizedPath = path.replace(/\/+$/, '');
    const pathParts = normalizedPath.split('/').filter(Boolean);
    let currentNodes = tree;

    // Navigate through the tree by matching path segments
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Find node by matching name and type (directory for intermediate segments)
      const node = currentNodes.find((n) => {
        // For intermediate segments, must be a directory
        // For the last segment, can be either file or directory
        if (i < pathParts.length - 1 && n.type !== 'directory') {
          return false;
        }
        // Match by name - the path will be built incrementally
        return n.name === part;
      });

      if (!node) {
        return null;
      }

      // If this is the last part, return the node
      if (i === pathParts.length - 1) {
        // Verify the path matches (handle edge cases)
        const nodePathNormalized = node.path.replace(/\/+$/, '');
        if (nodePathNormalized === normalizedPath) {
          return node;
        }
        // If path doesn't match exactly, still return if name matches (for robustness)
        return node;
      }

      // Must be a directory to continue
      if (node.type !== 'directory' || !node.children) {
        return null;
      }

      currentNodes = node.children;
    }

    return null;
  }, []);

  // Load tree structure once on mount
  useEffect(() => {
    const loadTreeStructure = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to load complete tree structure from storage
        try {
          const repoLabel = getCurrentRepoLabel();
          if (repoLabel) {
            const [owner, repo] = repoLabel.split('/');
            const branch = getCurrentBranch();
            const identifier = getGitHubRepoIdentifier(owner, repo);

            const storedTree = await getTreeStructure('github', identifier, branch);

            if (storedTree && storedTree.length > 0) {
              // Mark all directories as loaded since we have the complete structure
              markDirectoriesAsLoaded(storedTree);
              setCompleteTree(storedTree);
              setRootNodes(storedTree);
              return; // Successfully loaded complete tree
            }
          }
        } catch (storageError) {
          console.warn('Failed to load complete tree from storage, falling back:', storageError);
        }

        // Fallback: load tree via buildFileTree.
        // For curated repos this returns the full manifest tree (all children populated).
        // Set completeTree so subsequent directory expansions use in-memory data
        // instead of re-fetching the manifest on every click.
        const nodes = listDirectory ? await listDirectory('') : await buildFileTree('');
        setRootNodes(nodes);
        const hasPopulatedDirs = nodes.some(
          (n) => n.type === 'directory' && n.children !== undefined
        );
        if (hasPopulatedDirs) {
          markDirectoriesAsLoaded(nodes);
          setCompleteTree(nodes);
        }
      } catch (err) {
        // Check if it's a rate limit error
        if (err instanceof GitHubApiError && err.status === 403) {
          setRateLimit(err);
        }
        setError(err instanceof Error ? err.message : 'Failed to load file tree');
        console.error('Failed to load tree structure:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTreeStructure();
  }, [listDirectory, setRateLimit, markDirectoriesAsLoaded]);

  useEffect(() => {
    const expandPath = async (path: string) => {
      const normalized = path.replace(/\/+$/, '');
      if (!normalized) return;
      const segments = normalized.split('/');
      let didChange = false;
      const pathsToExpand = new Set<string>();

      // If we have the complete tree in memory, use it for instant synchronous expansion
      if (completeTree) {
        for (let i = 0; i < segments.length; i++) {
          const currentPath = segments.slice(0, i + 1).join('/');
          const normalizedCurrentPath = currentPath.replace(/\/+$/, '');

          // Find node in complete tree
          const node = findNodeInTree(completeTree, currentPath);

          if (!node || node.type !== 'directory') {
            break;
          }

          // Mark as loaded and expanded (no async calls needed!)
          node.isLoaded = true;
          if (!expandedPaths.has(normalizedCurrentPath)) {
            pathsToExpand.add(normalizedCurrentPath);
            node.isExpanded = true;
            didChange = true;
          }
        }
      } else {
        // Fallback: original sequential loading approach
        let currentNodes = rootNodes;
        for (let i = 0; i < segments.length; i++) {
          const currentPath = segments.slice(0, i + 1).join('/');
          const normalizedCurrentPath = currentPath.replace(/\/+$/, '');
          const node = currentNodes.find((n) => n.path === currentPath);
          if (!node || node.type !== 'directory') {
            break;
          }

          if (!node.isLoaded) {
            try {
              const childNodes = listDirectory
                ? await listDirectory(node.path)
                : await buildFileTree(node.path);
              node.children = childNodes;
              node.isLoaded = true;
              didChange = true;
            } catch (err) {
              console.error('Failed to auto-expand directory:', err);
              break;
            }
          }

          // Add to expanded paths if not already expanded
          if (!expandedPaths.has(normalizedCurrentPath)) {
            pathsToExpand.add(normalizedCurrentPath);
            node.isExpanded = true;
            didChange = true;
          }

          currentNodes = node.children || [];
        }
      }

      if (didChange || pathsToExpand.size > 0) {
        // Update expanded paths state
        if (pathsToExpand.size > 0) {
          setExpandedPaths((prev) => {
            const newSet = new Set(prev);
            pathsToExpand.forEach((path) => newSet.add(path));
            return newSet;
          });
        }

        // Update root nodes to trigger re-render
        setRootNodes((prev) => [...prev]);
      }
    };

    if (!expandDirectoryRequest) return;
    if (rootNodes.length === 0) return;
    if (expandDirectoryRequest.id === handledRequestRef.current) return;
    handledRequestRef.current = expandDirectoryRequest.id;
    expandPath(expandDirectoryRequest.path);
  }, [
    expandDirectoryRequest,
    listDirectory,
    expandedPaths,
    rootNodes,
    completeTree,
    findNodeInTree,
  ]);

  // Smooth scroll to selected file/folder when it changes
  useEffect(() => {
    if (!selectedFile || !treeContainerRef.current) return;

    // Clear any pending scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Normalize the path (remove trailing slashes) for comparison
    const normalizedPath = selectedFile.replace(/\/+$/, '');

    // Function to find and scroll to the element
    const scrollToElement = () => {
      if (!treeContainerRef.current) return;

      // Try exact match first (normalized path)
      let targetElement = treeContainerRef.current.querySelector(
        `[data-file-path="${normalizedPath}"]`
      ) as HTMLElement;

      // If not found, try with trailing slash (for directories)
      if (!targetElement) {
        const pathWithSlash = `${normalizedPath}/`;
        targetElement = treeContainerRef.current.querySelector(
          `[data-file-path="${pathWithSlash}"]`
        ) as HTMLElement;
      }

      // If still not found, try the original path
      if (!targetElement && selectedFile !== normalizedPath) {
        targetElement = treeContainerRef.current.querySelector(
          `[data-file-path="${selectedFile}"]`
        ) as HTMLElement;
      }

      if (targetElement) {
        // Scroll the element into view with smooth behavior
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
        return true; // Element found and scrolled
      }
      return false; // Element not found yet
    };

    // Wait for directory expansion to complete, then scroll
    // Use multiple retries to handle async directory loading
    const attemptScroll = (attempt: number = 0) => {
      const maxAttempts = 5;
      const delay = 200 + attempt * 200; // Increasing delays: 200ms, 400ms, 600ms, etc.

      scrollTimeoutRef.current = setTimeout(() => {
        const found = scrollToElement();
        // If not found and we haven't exceeded max attempts, try again
        if (!found && attempt < maxAttempts) {
          attemptScroll(attempt + 1);
        }
      }, delay);
    };

    // Start attempting to scroll
    attemptScroll();

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [selectedFile, rootNodes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {(titleLabel || onSourceModeChange) && (
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid var(--vscode-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--vscode-text-muted, #999)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={titleLabel}
          >
            {titleLabel || 'Explorer'}
          </div>
          {onSourceModeChange && sourceMode && (
            <div
              ref={sourceMenuRef}
              style={{ flexShrink: 0, position: 'relative', display: 'flex' }}
            >
              <button
                type="button"
                aria-label="Open file source menu"
                aria-haspopup="true"
                aria-expanded={isSourceMenuOpen}
                onClick={() => setIsSourceMenuOpen((current) => !current)}
                style={{
                  border: '1px solid var(--vscode-border)',
                  background: 'var(--vscode-editor-background, #1e1e1e)',
                  color: 'var(--vscode-foreground, #d4d4d4)',
                  borderRadius: '4px',
                  width: '24px',
                  height: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                title="File source"
              >
                <SourceModeGearIcon />
              </button>

              {isSourceMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 20,
                    minWidth: '132px',
                    padding: '6px',
                    border: '1px solid var(--vscode-border)',
                    borderRadius: '6px',
                    background: 'var(--vscode-editor-background, #1e1e1e)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
                  }}
                >
                  <div
                    style={{
                      padding: '2px 2px 6px',
                      fontSize: '10px',
                      lineHeight: 1.4,
                      color: 'var(--vscode-text-muted, #999)',
                    }}
                  >
                    <div
                      style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '2px',
                      }}
                    >
                      {currentRefKind}
                    </div>
                    <div
                      style={{
                        color: 'var(--vscode-foreground, #d4d4d4)',
                        wordBreak: 'break-all',
                      }}
                      title={currentRef}
                    >
                      {currentRefLabel}
                    </div>
                  </div>
                  <select
                    aria-label="Select file source"
                    className="vscode-source-select"
                    value={sourceMode}
                    onChange={(event) => {
                      onSourceModeChange(event.target.value as FileSourceMode);
                      setIsSourceMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid var(--vscode-border)',
                      background: 'var(--vscode-editor-background, #1e1e1e)',
                      color: 'var(--vscode-foreground, #d4d4d4)',
                      borderRadius: '4px',
                      padding: '4px 24px 4px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="local-filesystem">Local filesystem</option>
                    <option value="r2-bucket">R2 bucket</option>
                    <option value="github-api">api.github.com</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div
        ref={treeContainerRef}
        className={isLoading || error ? undefined : 'vscode-file-tree'}
        style={{ flex: 1, minHeight: 0 }}
      >
        {isLoading ? (
          <div className="vscode-loading">
            <div className="vscode-spinner" />
            <div>Loading source tree...</div>
          </div>
        ) : error ? (
          <div className="vscode-loading">
            <div>⚠️ Failed to load</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
          </div>
        ) : (
          sortFileNodes(rootNodes).map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              level={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              listDirectory={listDirectory}
              onDirectoryExpand={onDirectoryExpand}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FileTree;
