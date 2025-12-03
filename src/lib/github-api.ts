// GitHub API utilities for fetching Linux kernel source code

import { GitHubApiResponse, FileNode, GitHubTag, GITHUB_CONFIG } from '@/types';
import { getCacheKey, getCachedData, setCachedData } from './github-cache';

type GitHubConfig = {
  owner: string;
  repo: string;
  branch: string;
  apiBase: string;
  rawBase: string;
};

let currentConfig: GitHubConfig = { ...GITHUB_CONFIG };

export function setGitHubRepo(owner: string, repo: string, branch: string = 'master') {
  currentConfig = { ...currentConfig, owner, repo, branch };
}

/**
 * Set GitHub repository and automatically detect default branch if 'master' is specified
 */
export async function setGitHubRepoWithDefaultBranch(
  owner: string,
  repo: string,
  branch: string = 'master'
): Promise<void> {
  // If branch is 'master', try to fetch the actual default branch
  if (branch === 'master') {
    try {
      const defaultBranch = await fetchDefaultBranch(owner, repo);
      currentConfig = { ...currentConfig, owner, repo, branch: defaultBranch };
      return;
    } catch (error) {
      // If fetching default branch fails, fall back to 'master'
      console.warn('Failed to fetch default branch, using master:', error);
    }
  }
  currentConfig = { ...currentConfig, owner, repo, branch };
}

export function getCurrentRepoLabel(): string {
  return `${currentConfig.owner}/${currentConfig.repo}`;
}

export function getCurrentBranch(): string {
  return currentConfig.branch;
}

/**
 * Fetch the default branch for a repository
 */
export async function fetchDefaultBranch(owner: string, repo: string): Promise<string> {
  const cacheKey = getCacheKey(owner, repo, '', '', 'default-branch');

  // Try cache first
  const cached = await getCachedData<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${currentConfig.apiBase}/${owner}/${repo}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Fallback to common defaults if API fails
      return 'main';
    }

    const data = await response.json();
    const defaultBranch = data.default_branch || 'main';

    // Cache the result
    await setCachedData(cacheKey, defaultBranch);

    return defaultBranch;
  } catch {
    // Fallback to common defaults on error
    return 'main';
  }
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/**
 * Fetch available kernel versions (tags) from GitHub
 */
export async function fetchKernelVersions(): Promise<GitHubTag[]> {
  const cacheKey = getCacheKey(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    '',
    'tags'
  );

  // Try cache first
  const cached = await getCachedData<GitHubTag[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/tags?per_page=100`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. ${
            rateLimitRemaining === '0' && rateLimitReset
              ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}`
              : 'Please try again later or authenticate with GitHub for higher limits.'
          }`,
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
    throw new GitHubApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch directory contents from GitHub API
 */
export async function fetchDirectoryContents(path: string = ''): Promise<GitHubApiResponse[]> {
  // Validate configuration
  if (!currentConfig.owner || !currentConfig.repo) {
    throw new GitHubApiError(
      `Repository not configured. Please set owner and repo before fetching directory contents.`,
      400
    );
  }

  const cacheKey = getCacheKey(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path,
    'directory'
  );

  // Try cache first
  const cached = await getCachedData<GitHubApiResponse[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Encode path segments properly for URL (GitHub API expects each segment encoded)
  const encodedPath = path
    ? path
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/')
    : '';
  const url = encodedPath
    ? `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${encodedPath}?ref=${encodeURIComponent(currentConfig.branch)}`
    : `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents?ref=${encodeURIComponent(currentConfig.branch)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. ${
            rateLimitRemaining === '0' && rateLimitReset
              ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}`
              : 'Please try again later or authenticate with GitHub for higher limits.'
          }`,
          response.status
        );
      }

      // Try to get error message from response body
      let errorMessage = response.statusText || `HTTP ${response.status}`;
      let errorData: { message?: string } | null = null;
      try {
        errorData = await response.json().catch(() => null);
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse errors, use statusText
      }

      // If branch doesn't exist (404 or "No commit found"), try to fetch default branch and retry
      if (response.status === 404 || errorMessage.includes('No commit found')) {
        try {
          const defaultBranch = await fetchDefaultBranch(currentConfig.owner, currentConfig.repo);
          // Only retry if the default branch is different from what we tried
          if (defaultBranch !== currentConfig.branch) {
            // Update config with default branch
            currentConfig.branch = defaultBranch;
            // Retry the request with the default branch
            const retryUrl = encodedPath
              ? `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${encodedPath}?ref=${encodeURIComponent(defaultBranch)}`
              : `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents?ref=${encodeURIComponent(defaultBranch)}`;

            const retryResponse = await fetch(retryUrl, {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Linux-Kernel-Explorer',
              },
            });

            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const contents = Array.isArray(retryData) ? retryData : [];

              // Update cache key with new branch
              const newCacheKey = getCacheKey(
                currentConfig.owner,
                currentConfig.repo,
                defaultBranch,
                path,
                'directory'
              );
              await setCachedData(newCacheKey, contents);

              return contents;
            }
          }
        } catch (retryError) {
          // If retry fails, fall through to original error
          console.warn('Failed to retry with default branch:', retryError);
        }
      }

      const pathDisplay = path || 'root';
      throw new GitHubApiError(
        `Failed to fetch directory "${pathDisplay}": ${errorMessage}`,
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
    throw new GitHubApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch file content from GitHub API
 */
export async function fetchFileContent(path: string): Promise<string> {
  // Validate configuration
  if (!currentConfig.owner || !currentConfig.repo) {
    throw new GitHubApiError(
      `Repository not configured. Please set owner and repo before fetching file content.`,
      400
    );
  }

  if (!path) {
    throw new GitHubApiError(`File path is required`, 400);
  }

  const cacheKey = getCacheKey(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path,
    'file'
  );

  // Try cache first
  const cached = await getCachedData<string>(cacheKey);
  if (cached) {
    return cached;
  }

  // Encode path segments properly for URL (GitHub API expects each segment encoded)
  const encodedPath = path
    ? path
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/')
    : '';
  const url = encodedPath
    ? `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${encodedPath}?ref=${encodeURIComponent(currentConfig.branch)}`
    : `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents?ref=${encodeURIComponent(currentConfig.branch)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Linux-Kernel-Explorer',
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. ${
            rateLimitRemaining === '0' && rateLimitReset
              ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}`
              : 'Please try again later or authenticate with GitHub for higher limits.'
          }`,
          response.status
        );
      }

      // Try to get error message from response body
      let errorMessage = response.statusText || `HTTP ${response.status}`;
      let errorData: { message?: string } | null = null;
      try {
        errorData = await response.json().catch(() => null);
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse errors, use statusText
      }

      // If branch doesn't exist (404 or "No commit found"), try to fetch default branch and retry
      if (response.status === 404 || errorMessage.includes('No commit found')) {
        try {
          const defaultBranch = await fetchDefaultBranch(currentConfig.owner, currentConfig.repo);
          // Only retry if the default branch is different from what we tried
          if (defaultBranch !== currentConfig.branch) {
            // Update config with default branch
            currentConfig.branch = defaultBranch;
            // Retry the request with the default branch
            const retryEncodedPath = path
              ? path
                  .split('/')
                  .filter(Boolean)
                  .map((segment) => encodeURIComponent(segment))
                  .join('/')
              : '';
            const retryUrl = retryEncodedPath
              ? `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${retryEncodedPath}?ref=${encodeURIComponent(defaultBranch)}`
              : `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents?ref=${encodeURIComponent(defaultBranch)}`;

            const retryResponse = await fetch(retryUrl, {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Linux-Kernel-Explorer',
              },
            });

            if (retryResponse.ok) {
              const retryData: GitHubApiResponse = await retryResponse.json();

              if (retryData.type === 'dir') {
                throw new GitHubApiError(`Path is a directory, not a file: ${path}`);
              }

              if (retryData.type !== 'file' || !retryData.content) {
                throw new GitHubApiError(`Invalid file response from GitHub API - File: ${path}`);
              }

              // Decode base64 content
              const content =
                retryData.encoding === 'base64'
                  ? atob(retryData.content.replace(/\n/g, ''))
                  : retryData.content;

              // Update cache key with new branch
              const newCacheKey = getCacheKey(
                currentConfig.owner,
                currentConfig.repo,
                defaultBranch,
                path,
                'file'
              );
              await setCachedData(newCacheKey, content);

              return content;
            }
          }
        } catch (retryError) {
          // If retry fails, fall through to original error
          console.warn('Failed to retry with default branch:', retryError);
        }
      }

      throw new GitHubApiError(`Failed to fetch file "${path}": ${errorMessage}`, response.status);
    }

    const data: GitHubApiResponse = await response.json();

    if (data.type === 'dir') {
      throw new GitHubApiError(`Path is a directory, not a file: ${path}`);
    }

    if (data.type !== 'file' || !data.content) {
      throw new GitHubApiError(`Invalid file response from GitHub API - File: ${path}`);
    }

    // Decode base64 content
    const content =
      data.encoding === 'base64' ? atob(data.content.replace(/\n/g, '')) : data.content;

    // Cache the result
    await setCachedData(cacheKey, content);

    return content;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
