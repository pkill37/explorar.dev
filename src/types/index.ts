// Explorar.dev - Type Definitions

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  isExpanded?: boolean;
  isLoaded?: boolean;
}

export interface EditorTab {
  id: string;
  title: string;
  path: string;
  isActive: boolean;
  isDirty: boolean;
  content?: string;
  isLoading: boolean;
  scrollToLine?: number; // Line number to scroll to when opening
  searchPattern?: string; // Pattern to search for and highlight
}

export interface KernelSuggestion {
  id: string;
  type: 'concept' | 'function' | 'structure' | 'memory' | 'process' | 'security';
  title: string;
  description: string;
  relatedFiles: string[];
  kernelMindReference?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GitHubApiResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  zipball_url: string;
  tarball_url: string;
  node_id: string;
}

export interface PullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
  previous_filename?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  base: {
    ref: string;
    sha: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  html_url: string;
  diff_url: string;
  patch_url: string;
}

export interface PullRequestDiff {
  file: PullRequestFile;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  heading: string;
  lines: DiffLine[];
}

export interface DiffLine {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'context' | 'added' | 'removed';
  content: string;
}

// File System Access API types (for browser compatibility)
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    getDirectoryHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
}

// GitHub API constants
export const GITHUB_CONFIG = {
  owner: 'torvalds',
  repo: 'linux',
  branch: 'v6.1', // Very stable 6.x LTS branch
  apiBase: 'https://api.github.com/repos',
  rawBase: 'https://raw.githubusercontent.com',
} as const;
