'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileNode } from '@/types';
import { buildFileTree, getFileIcon } from '@/lib/github-api';

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  listDirectory?: (path: string) => Promise<FileNode[]>;
  titleLabel?: string;
  refreshKey?: string;
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
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  level,
  onFileSelect,
  selectedFile,
  listDirectory,
  onDirectoryExpand,
}) => {
  const [isExpanded, setIsExpanded] = useState(node.isExpanded || false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsExpanded(node.isExpanded || false);
  }, [node.isExpanded]);

  useEffect(() => {
    setChildren(node.children || []);
  }, [node.children]);

  const handleToggle = async () => {
    if (node.type === 'file') {
      onFileSelect(node.path);
      return;
    }

    if (!isExpanded && !node.isLoaded) {
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
      } finally {
        setIsLoading(false);
      }
    }

    setIsExpanded(!isExpanded);
    node.isExpanded = !isExpanded;
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggle();
  };

  const isSelected = selectedFile === node.path;

  return (
    <div>
      <div
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
        {node.size && node.type === 'file' && (
          <span className="size">{formatFileSize(node.size)}</span>
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              listDirectory={listDirectory}
              onDirectoryExpand={onDirectoryExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const FileTree: React.FC<FileTreeProps> = ({
  onFileSelect,
  selectedFile,
  listDirectory,
  refreshKey,
  onDirectoryExpand,
  expandDirectoryRequest,
}) => {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handledRequestRef = useRef<number | null>(null);

  useEffect(() => {
    const loadRootDirectory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const nodes = listDirectory ? await listDirectory('') : await buildFileTree('');
        setRootNodes(nodes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file tree');
        console.error('Failed to load root directory:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadRootDirectory();
  }, [listDirectory, refreshKey]);

  useEffect(() => {
    const expandPath = async (path: string) => {
      const normalized = path.replace(/\/+$/, '');
      if (!normalized) return;
      const segments = normalized.split('/');
      let currentNodes = rootNodes;
      let didChange = false;

      for (let i = 0; i < segments.length; i++) {
        const currentPath = segments.slice(0, i + 1).join('/');
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

        if (!node.isExpanded) {
          node.isExpanded = true;
          didChange = true;
        }

        currentNodes = node.children || [];
      }

      if (didChange) {
        setRootNodes((prev) => [...prev]);
      }
    };

    if (!expandDirectoryRequest) return;
    if (rootNodes.length === 0) return;
    if (expandDirectoryRequest.id === handledRequestRef.current) return;
    handledRequestRef.current = expandDirectoryRequest.id;
    expandPath(expandDirectoryRequest.path);
  }, [expandDirectoryRequest, rootNodes, listDirectory]);

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
    <div className="vscode-file-tree">
      {rootNodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          level={0}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          listDirectory={listDirectory}
          onDirectoryExpand={onDirectoryExpand}
        />
      ))}
    </div>
  );
};

export default FileTree;
