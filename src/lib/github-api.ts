// GitHub API utilities for fetching Linux kernel source code

import { GitHubApiResponse, FileNode, GitHubTag, GITHUB_CONFIG } from '@/types';
import { getCacheKey, getCachedData, setCachedData } from './github-cache';

let currentConfig = { ...GITHUB_CONFIG };

export function setGitHubRepo(owner: string, repo: string, branch: string = 'master') {
  currentConfig = { ...currentConfig, owner, repo, branch } as typeof GITHUB_CONFIG;
}

export function getCurrentRepoLabel(): string {
  return `${currentConfig.owner}/${currentConfig.repo}`;
}

export function getCurrentBranch(): string {
  return currentConfig.branch;
}

export class GitHubApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/**
 * Fetch available kernel versions (tags) from GitHub
 */
export async function fetchKernelVersions(): Promise<GitHubTag[]> {
  const cacheKey = getCacheKey(currentConfig.owner, currentConfig.repo, currentConfig.branch, '', 'tags');
  
  // Try cache first
  const cached = await getCachedData<GitHubTag[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/tags?per_page=100`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. ${rateLimitRemaining === '0' && rateLimitReset 
            ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}` 
            : 'Please try again later or authenticate with GitHub for higher limits.'}`,
          response.status
        );
      }
      throw new GitHubApiError(
        `Failed to fetch kernel versions: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const versions = Array.isArray(data) ? data : [];
    
    // Cache the result
    await setCachedData(cacheKey, versions);
    
    return versions;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch directory contents from GitHub API
 */
export async function fetchDirectoryContents(path: string = ''): Promise<GitHubApiResponse[]> {
  const cacheKey = getCacheKey(currentConfig.owner, currentConfig.repo, currentConfig.branch, path, 'directory');
  
  // Try cache first
  const cached = await getCachedData<GitHubApiResponse[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${path}?ref=${currentConfig.branch}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. ${rateLimitRemaining === '0' && rateLimitReset 
            ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}` 
            : 'Please try again later or authenticate with GitHub for higher limits.'}`,
          response.status
        );
      }
      throw new GitHubApiError(
        `Failed to fetch directory: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const contents = Array.isArray(data) ? data : [];
    
    // Cache the result
    await setCachedData(cacheKey, contents);
    
    return contents;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch file content from GitHub API
 */
export async function fetchFileContent(path: string): Promise<string> {
  const cacheKey = getCacheKey(currentConfig.owner, currentConfig.repo, currentConfig.branch, path, 'file');
  
  // Try cache first
  const cached = await getCachedData<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${path}?ref=${currentConfig.branch}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. ${rateLimitRemaining === '0' && rateLimitReset 
            ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}` 
            : 'Please try again later or authenticate with GitHub for higher limits.'}`,
          response.status
        );
      }
      throw new GitHubApiError(
        `Failed to fetch file: ${response.statusText}`,
        response.status
      );
    }

    const data: GitHubApiResponse = await response.json();
    
    if (data.type === 'dir') {
      throw new GitHubApiError(`Path is a directory, not a file: ${path}`);
    }
    
    if (data.type !== 'file' || !data.content) {
      throw new GitHubApiError(`Invalid file response from GitHub API - File: ${path}`);
    }

    // Decode base64 content
    const content = data.encoding === 'base64' 
      ? atob(data.content.replace(/\n/g, ''))
      : data.content;

    // Cache the result
    await setCachedData(cacheKey, content);

    return content;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert GitHub API response to FileNode structure
 */
export function convertToFileNode(item: GitHubApiResponse): FileNode {
  return {
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'directory' : 'file',
    size: item.size,
    isExpanded: false,
    isLoaded: false,
  };
}

/**
 * Build file tree from GitHub directory contents
 */
export async function buildFileTree(path: string = ''): Promise<FileNode[]> {
  try {
    const contents = await fetchDirectoryContents(path);
    return contents.map(convertToFileNode).sort((a, b) => {
      // Directories first, then files, both alphabetically
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    console.error(`Failed to build file tree for path: ${path}`, error);
    return [];
  }
}


/**
 * Get file icon based on type and extension
 */
export function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') {
    return node.isExpanded ? '📂' : '📁';
  }
  
  const extension = node.name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'c':
      return '⚙️';
    case 'h':
      return '🔧';
    case 's':
    case 'S':
      return '🔩';
    case 'py':
      return '🐍';
    case 'sh':
      return '🐚';
    case 'md':
      return '📖';
    case 'json':
      return '📋';
    case 'yaml':
    case 'yml':
      return '⚙️';
    default:
      return '📄';
  }
}
