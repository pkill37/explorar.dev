// Linux Kernel Explorer - Type Definitions

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

// GitHub API constants
export const GITHUB_CONFIG = {
  owner: 'torvalds',
  repo: 'linux',
  branch: 'master',
  apiBase: 'https://api.github.com/repos',
  rawBase: 'https://raw.githubusercontent.com',
} as const;

