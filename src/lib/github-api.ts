// GitHub API utilities for fetching source code from GitHub repositories

import { GitHubApiResponse, FileNode, GITHUB_CONFIG } from '@/types';
import { getCacheKey, getCachedData, setCachedData } from './github-cache';
import { retryWithBackoff, githubCircuitBreaker } from './github-retry';
import {
  readFileFromStorage,
  listDirectoryFromStorage,
  getGitHubRepoIdentifier,
  FileEntry,
  isFileAvailable,
  getDirectoryMetadata,
  getTreeStructure,
} from './repo-storage';
import { downloadFileFromGitHub, downloadDirectoryContents } from './github-archive';

/**
 * Build headers for GitHub API requests
 */
function buildGitHubHeaders(): HeadersInit {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Explorar.dev',
  };
}

type GitHubConfig = {
  owner: string;
  repo: string;
  branch: string;
  apiBase: string;
  rawBase: string;
};

let currentConfig: GitHubConfig = { ...GITHUB_CONFIG };

/**
 * Trusted version for each repository
 * Only one trusted branch per repository for now
 * Main/master branches are excluded as they are unstable
 */
const TRUSTED_VERSIONS: Record<string, string> = {
  'torvalds/linux': 'v6.1',
  'llvm/llvm-project': 'llvmorg-18.1.0',
  'bminor/glibc': 'glibc-2.39',
  'python/cpython': 'v3.12.0',
} as const;

/**
 * Check if a branch/version is unstable (main or master)
 */
export function isUnstableBranch(branch: string): boolean {
  return branch === 'main' || branch === 'master';
}

/**
 * Filter out unstable branches (main/master) from a list
 */
export function filterUnstableBranches(branches: string[]): string[] {
  return branches.filter((branch) => !isUnstableBranch(branch));
}

/**
 * Get trusted version for a repository
 * Returns the single trusted version for the repo, or empty string if not configured
 * Main/master branches are never included
 */
export function getTrustedVersion(owner: string, repo: string): string {
  const key = `${owner}/${repo}`;
  return TRUSTED_VERSIONS[key] || '';
}

/**
 * @deprecated Use getTrustedVersion instead. Kept for backward compatibility.
 */
export function getTrustedVersions(owner: string, repo: string): string[] {
  const version = getTrustedVersion(owner, repo);
  return version ? [version] : [];
}

/**
 * Set GitHub repository and automatically detect default branch if 'master' or unstable branch is specified
 * Main/master branches are never allowed - will be replaced with first trusted version
 */
export async function setGitHubRepoWithDefaultBranch(
  owner: string,
  repo: string,
  branch: string = 'v6.1'
): Promise<void> {
  // Never allow main/master branches - they are unstable
  if (isUnstableBranch(branch)) {
    const trusted = getTrustedVersion(owner, repo);
    if (trusted) {
      currentConfig = { ...currentConfig, owner, repo, branch: trusted };
      return;
    }
    // Fallback to a safe default if no trusted version
    currentConfig = { ...currentConfig, owner, repo, branch: 'v6.1' };
    return;
  }

  const trusted = getTrustedVersion(owner, repo);

  if (trusted) {
    // If branch is not the trusted version, use trusted version
    if (trusted !== branch) {
      currentConfig = { ...currentConfig, owner, repo, branch: trusted };
      return;
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
 * Get repository identifier for current config
 */
export function getRepoIdentifier(owner?: string, repo?: string): string {
  const ownerName = owner || currentConfig.owner;
  const repoName = repo || currentConfig.repo;
  return getGitHubRepoIdentifier(ownerName, repoName);
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
 * Try to find a valid branch from our trusted learning versions
 * Returns the first version that exists in the repository, or null if none work
 */
async function tryTrustedVersions(
  owner: string,
  repo: string,
  currentBranch: string
): Promise<string | null> {
  // Try each trusted version in order
  const trusted = getTrustedVersions(owner, repo);
  for (const version of trusted) {
    // Skip if it's the same as the current branch (already tried)
    if (version === currentBranch) {
      continue;
    }

    // Quick check: try to fetch the root directory to see if branch exists
    try {
      const testUrl = `${currentConfig.apiBase}/${owner}/${repo}/contents?ref=${encodeURIComponent(version)}`;
      const testResponse = await fetch(testUrl, {
        headers: buildGitHubHeaders(),
      });

      if (testResponse.ok) {
        return version;
      }
    } catch (error) {
      console.error(`Error checking trusted version ${version}:`, error);
      // Continue to next version
      continue;
    }
  }

  return null;
}

/**
 * Convert FileEntry to GitHubApiResponse format
 */
function convertFileEntryToGitHubResponse(
  entry: FileEntry,
  basePath: string = ''
): GitHubApiResponse {
  const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;

  return {
    name: entry.name,
    path: fullPath,
    sha: '', // Not available in local storage
    size: entry.size || 0,
    url: '', // Not applicable for local storage
    html_url: '', // Not applicable for local storage
    git_url: '', // Not applicable for local storage
    download_url: null, // Not applicable for local storage
    type: entry.type === 'directory' ? 'dir' : 'file',
    content: undefined, // Will be loaded separately if needed
    encoding: undefined,
  };
}

/**
 * Try to fetch directory contents from local storage first, fallback to GitHub API
 */
async function tryFetchFromStorage(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<GitHubApiResponse[] | null> {
  try {
    const identifier = getGitHubRepoIdentifier(owner, repo);

    // Check if directory metadata exists in local storage
    const metadata = await getDirectoryMetadata('github', identifier, branch, path);
    if (metadata) {
      // Convert to GitHub API format
      return metadata.map((entry) => convertFileEntryToGitHubResponse(entry, path));
    }

    // Fallback: try listing from actual files (for backward compatibility)
    const entries = await listDirectoryFromStorage('github', identifier, branch, path);
    if (entries.length > 0) {
      return entries.map((entry) => convertFileEntryToGitHubResponse(entry, path));
    }

    return null; // Not available locally
  } catch (error) {
    console.error('Error fetching from storage:', error);
    return null; // Fall back to GitHub API
  }
}

/**
 * Try to fetch file content from local storage first, fallback to GitHub API
 */
async function tryFetchFileFromStorage(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | null> {
  try {
    const identifier = getGitHubRepoIdentifier(owner, repo);

    // Check if file exists in storage
    const exists = await isFileAvailable('github', identifier, branch, path);
    if (!exists) {
      return null; // Not available locally
    }

    // Fetch from local storage
    return await readFileFromStorage('github', identifier, branch, path);
  } catch (error) {
    console.error('Error fetching file from storage:', error);
    return null; // Fall back to GitHub API
  }
}

/**
 * Fetch directory contents from local storage first, then GitHub API as fallback
 */
export async function fetchDirectoryContents(path: string = ''): Promise<GitHubApiResponse[]> {
  // Validate configuration
  if (!currentConfig.owner || !currentConfig.repo) {
    const error = new GitHubApiError(
      `Repository not configured. Please set owner and repo before fetching directory contents.`,
      400
    );
    throw error;
  }

  // Validate branch is the trusted version
  const trusted = getTrustedVersion(currentConfig.owner, currentConfig.repo);
  if (trusted && trusted !== currentConfig.branch) {
    const error = new GitHubApiError(
      `Invalid branch "${currentConfig.branch}" for ${currentConfig.owner}/${currentConfig.repo}. Only trusted version is allowed: ${trusted}`,
      400
    );
    throw error;
  }

  // Try local storage first
  const storageResult = await tryFetchFromStorage(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path
  );
  if (storageResult) {
    return storageResult;
  }

  // If not in local storage, try on-demand download
  const identifier = getGitHubRepoIdentifier(currentConfig.owner, currentConfig.repo);
  const metadata = await getDirectoryMetadata('github', identifier, currentConfig.branch, path);
  if (!metadata) {
    // Directory metadata doesn't exist - download it on-demand
    try {
      const entries = await downloadDirectoryContents(
        currentConfig.owner,
        currentConfig.repo,
        currentConfig.branch,
        path
      );
      // Convert to GitHub API format
      const result = entries.map((entry) => convertFileEntryToGitHubResponse(entry, path));
      return result;
    } catch (error) {
      console.error('Error downloading directory contents:', error);
      // Fall through to API fetch below
    }
  }

  // If not in local storage, try cache
  const cacheKey = getCacheKey(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path,
    'directory'
  );

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
    const result = await githubCircuitBreaker.execute(async () => {
      return retryWithBackoff(
        async () => {
          const response = await fetch(url, {
            headers: buildGitHubHeaders(),
          });

          if (!response.ok) {
            // Check for rate limiting
            if (response.status === 403) {
              const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
              const rateLimitReset = response.headers.get('x-ratelimit-reset');
              const error = new GitHubApiError(
                `GitHub API rate limit exceeded. ${
                  rateLimitRemaining === '0' && rateLimitReset
                    ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}`
                    : 'Please try again later or authenticate with GitHub for higher limits.'
                }`,
                response.status
              );
              throw error;
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

            // If branch doesn't exist (404, 422, or "No commit found"), try trusted learning versions
            // GitHub API returns 422 for invalid refs, 404 for missing resources
            if (
              response.status === 404 ||
              response.status === 422 ||
              errorMessage.includes('No commit found')
            ) {
              try {
                const validBranch = await tryTrustedVersions(
                  currentConfig.owner,
                  currentConfig.repo,
                  currentConfig.branch
                );

                if (validBranch) {
                  // Update config with valid branch
                  currentConfig.branch = validBranch;
                  // Retry the request with the valid branch
                  const retryUrl = encodedPath
                    ? `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${encodedPath}?ref=${encodeURIComponent(validBranch)}`
                    : `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents?ref=${encodeURIComponent(validBranch)}`;

                  const retryResponse = await fetch(retryUrl, {
                    headers: {
                      Accept: 'application/vnd.github.v3+json',
                      'User-Agent': 'Explorar.dev',
                    },
                  });

                  if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    const contents = Array.isArray(retryData) ? retryData : [];

                    // Update cache key with new branch
                    const newCacheKey = getCacheKey(
                      currentConfig.owner,
                      currentConfig.repo,
                      validBranch,
                      path,
                      'directory'
                    );
                    await setCachedData(newCacheKey, contents);

                    return contents;
                  }
                }
              } catch (retryError) {
                console.error('Error retrying directory fetch with trusted version:', retryError);
                // If retry fails, fall through to original error
              }
            }

            const pathDisplay = path || 'root';
            const error = new GitHubApiError(
              `Failed to fetch directory "${pathDisplay}": ${errorMessage}`,
              response.status
            );
            throw error;
          }

          const data = await response.json();
          const contents = Array.isArray(data) ? data : [];

          // Cache the result
          await setCachedData(cacheKey, contents);

          return contents;
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          onRetry: () => {
            // Retry in progress
          },
        }
      );
    });

    if (result.success && result.data) {
      return result.data;
    }

    throw result.error || new GitHubApiError('Failed to fetch directory contents after retries');
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    const apiError = new GitHubApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw apiError;
  }
}

/**
 * Fetch file content from local storage first, then GitHub API as fallback
 */
export async function fetchFileContent(path: string): Promise<string> {
  // Validate configuration
  if (!currentConfig.owner || !currentConfig.repo) {
    const error = new GitHubApiError(
      `Repository not configured. Please set owner and repo before fetching file content.`,
      400
    );
    throw error;
  }

  if (!path) {
    const error = new GitHubApiError(`File path is required`, 400);
    throw error;
  }

  // Validate branch is the trusted version
  const trusted = getTrustedVersion(currentConfig.owner, currentConfig.repo);
  if (trusted && trusted !== currentConfig.branch) {
    const error = new GitHubApiError(
      `Invalid branch "${currentConfig.branch}" for ${currentConfig.owner}/${currentConfig.repo}. Only trusted version is allowed: ${trusted}`,
      400
    );
    throw error;
  }

  // Try local storage first
  const storageResult = await tryFetchFileFromStorage(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path
  );
  if (storageResult) {
    return storageResult;
  }

  // Check if file is available in storage - if not, download on-demand
  const identifier = getGitHubRepoIdentifier(currentConfig.owner, currentConfig.repo);
  const fileAvailable = await isFileAvailable('github', identifier, currentConfig.branch, path);

  if (!fileAvailable) {
    // File is not downloaded - download it on-demand (lazy loading)
    try {
      const content = await downloadFileFromGitHub(
        currentConfig.owner,
        currentConfig.repo,
        currentConfig.branch,
        path
      );
      return content;
    } catch (error) {
      console.error('Error downloading file from GitHub:', error);
      // Fall through to API fetch below
    }
  }

  // If not in local storage, try cache
  const cacheKey = getCacheKey(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path,
    'file'
  );

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
    const result = await githubCircuitBreaker.execute(async () => {
      return retryWithBackoff(
        async () => {
          const response = await fetch(url, {
            headers: buildGitHubHeaders(),
          });

          if (!response.ok) {
            // Check for rate limiting
            if (response.status === 403) {
              const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
              const rateLimitReset = response.headers.get('x-ratelimit-reset');
              const error = new GitHubApiError(
                `GitHub API rate limit exceeded. ${
                  rateLimitRemaining === '0' && rateLimitReset
                    ? `Resets at ${new Date(parseInt(rateLimitReset) * 1000).toLocaleString()}`
                    : 'Please try again later or authenticate with GitHub for higher limits.'
                }`,
                response.status
              );
              throw error;
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

            // If branch doesn't exist (404, 422, or "No commit found"), try trusted learning versions
            // GitHub API returns 422 for invalid refs, 404 for missing resources
            if (
              response.status === 404 ||
              response.status === 422 ||
              errorMessage.includes('No commit found')
            ) {
              try {
                const validBranch = await tryTrustedVersions(
                  currentConfig.owner,
                  currentConfig.repo,
                  currentConfig.branch
                );

                if (validBranch) {
                  // Update config with valid branch
                  currentConfig.branch = validBranch;
                  // Retry the request with the valid branch
                  const retryEncodedPath = path
                    ? path
                        .split('/')
                        .filter(Boolean)
                        .map((segment) => encodeURIComponent(segment))
                        .join('/')
                    : '';
                  const retryUrl = retryEncodedPath
                    ? `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${retryEncodedPath}?ref=${encodeURIComponent(validBranch)}`
                    : `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents?ref=${encodeURIComponent(validBranch)}`;

                  const retryResponse = await fetch(retryUrl, {
                    headers: {
                      Accept: 'application/vnd.github.v3+json',
                      'User-Agent': 'Explorar.dev',
                    },
                  });

                  if (retryResponse.ok) {
                    const retryData: GitHubApiResponse = await retryResponse.json();

                    if (retryData.type === 'dir') {
                      throw new GitHubApiError(`Path is a directory, not a file: ${path}`);
                    }

                    if (retryData.type !== 'file' || !retryData.content) {
                      throw new GitHubApiError(
                        `Invalid file response from GitHub API - File: ${path}`
                      );
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
                      validBranch,
                      path,
                      'file'
                    );
                    await setCachedData(newCacheKey, content);

                    return content;
                  }
                }
              } catch (retryError) {
                console.error('Error retrying file fetch with trusted version:', retryError);
                // If retry fails, fall through to original error
              }
            }

            const error = new GitHubApiError(
              `Failed to fetch file "${path}": ${errorMessage}`,
              response.status
            );
            throw error;
          }

          const data: GitHubApiResponse = await response.json();

          if (data.type === 'dir') {
            const error = new GitHubApiError(`Path is a directory, not a file: ${path}`);
            throw error;
          }

          if (data.type !== 'file' || !data.content) {
            const error = new GitHubApiError(
              `Invalid file response from GitHub API - File: ${path}`
            );
            throw error;
          }

          // Decode base64 content
          const content =
            data.encoding === 'base64' ? atob(data.content.replace(/\n/g, '')) : data.content;

          // Cache the result
          await setCachedData(cacheKey, content);

          return content;
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          onRetry: () => {
            // Retry in progress
          },
        }
      );
    });

    if (result.success && result.data) {
      return result.data;
    }

    throw result.error || new GitHubApiError('Failed to fetch file content after retries');
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    const apiError = new GitHubApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw apiError;
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
 * Sort FileNode array: directories first (with folder icons), then files (with file icons), both alphabetically
 */
export function sortFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes
    .sort((a, b) => {
      // Directories (trees) first, then files (blobs), both alphabetically
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    })
    .map((node) => {
      // Recursively sort children if they exist
      if (node.children) {
        return { ...node, children: sortFileNodes(node.children) };
      }
      return node;
    });
}

/**
 * Extract subtree from complete tree structure for a given path
 */
function extractSubtree(tree: FileNode[], path: string): FileNode[] {
  if (!path) {
    return tree;
  }

  const pathParts = path.split('/').filter(Boolean);
  let currentNodes = tree;

  for (const part of pathParts) {
    const node = currentNodes.find((n) => n.name === part && n.type === 'directory');
    if (!node || !node.children) {
      return [];
    }
    currentNodes = node.children;
  }

  return currentNodes;
}

/**
 * Update isLoaded status for files in tree based on availability
 */
async function updateFileLoadedStatus(
  nodes: FileNode[],
  owner: string,
  repo: string,
  branch: string
): Promise<void> {
  const identifier = getGitHubRepoIdentifier(owner, repo);

  for (const node of nodes) {
    if (node.type === 'file') {
      node.isLoaded = await isFileAvailable('github', identifier, branch, node.path);
    } else if (node.children) {
      await updateFileLoadedStatus(node.children, owner, repo, branch);
    }
  }
}

/**
 * Build file tree from stored tree structure or fallback to API
 */
export async function buildFileTree(path: string = ''): Promise<FileNode[]> {
  try {
    const { owner, repo, branch } = currentConfig;
    const identifier = getGitHubRepoIdentifier(owner, repo);

    // First, try to get complete tree structure from storage
    const completeTree = await getTreeStructure('github', identifier, branch);

    if (completeTree && completeTree.length > 0) {
      // Extract subtree for requested path
      let subtree = extractSubtree(completeTree, path);

      // Update isLoaded status for files based on availability
      // We need to update the entire tree, not just the subtree
      // So we'll update the complete tree and then extract
      await updateFileLoadedStatus(completeTree, owner, repo, branch);
      subtree = extractSubtree(completeTree, path);

      return subtree;
    }

    // Fallback to API-based approach (backward compatibility)
    const contents = await fetchDirectoryContents(path);
    return contents.map(convertToFileNode);
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
