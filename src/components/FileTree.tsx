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
} from '@/lib/github-api';
import { useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';
import { getTreeStructure, getGitHubRepoIdentifier } from '@/lib/repo-storage';

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  listDirectory?: (path: string) => Promise<FileNode[]>;
  titleLabel?: string;
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
  const isSelected = normalizePath(selectedFile || '') === normalizePath(node.path);

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
  onDirectoryExpand,
  expandDirectoryRequest,
}) => {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [completeTree, setCompleteTree] = useState<FileNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track expanded paths in centralized state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const handledRequestRef = useRef<number | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { setRateLimit } = useGitHubRateLimit();

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

        // Fallback: load root directory only (backward compatibility)
        const nodes = listDirectory ? await listDirectory('') : await buildFileTree('');
        setRootNodes(nodes);
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

  if (isLoading) {
    return (
      <div className="vscode-loading">
        <div className="vscode-spinner" />
        <div>Loading source tree...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vscode-loading">
        <div>⚠️ Failed to load</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
      </div>
    );
  }

  return (
    <div ref={treeContainerRef} className="vscode-file-tree">
      {sortFileNodes(rootNodes).map((node) => (
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
      ))}
    </div>
  );
};

export default FileTree;
