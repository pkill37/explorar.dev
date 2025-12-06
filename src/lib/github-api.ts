// GitHub API utilities for fetching source code from GitHub repositories

import {
  GitHubApiResponse,
  FileNode,
  GitHubTag,
  GITHUB_CONFIG,
  PullRequest,
  PullRequestFile,
  PullRequestDiff,
  DiffHunk,
} from '@/types';
import { getCacheKey, getCachedData, setCachedData } from './github-cache';
import { retryWithBackoff, githubCircuitBreaker } from './github-retry';
import { logger } from './github-debug';
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
 * Check if a branch/version is trusted for a repository
 */
export function isTrustedVersion(owner: string, repo: string, branch: string): boolean {
  const trusted = getTrustedVersion(owner, repo);
  return trusted ? trusted === branch : false;
}

/**
 * Legacy constant for backward compatibility (deprecated, use getTrustedVersions instead)
 */
export function setGitHubRepo(owner: string, repo: string, branch: string = 'v6.1') {
  // Validate branch is the trusted version
  const trusted = getTrustedVersion(owner, repo);
  if (trusted && trusted !== branch) {
    // Default to trusted version if invalid branch is provided
    branch = trusted;
  }
  currentConfig = { ...currentConfig, owner, repo, branch };
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

/**
 * Fetch the default branch for a repository
 */
export async function fetchDefaultBranch(owner: string, repo: string): Promise<string> {
  return logger.measure('fetchDefaultBranch', async () => {
    const cacheKey = getCacheKey(owner, repo, '', '', 'default-branch');

    // Try cache first
    const cached = await getCachedData<string>(cacheKey);
    if (cached) {
      logger.debug('Default branch cache hit', { owner, repo });
      return cached;
    }

    const url = `${currentConfig.apiBase}/${owner}/${repo}`;
    logger.debug('Fetching default branch', { owner, repo, url });

    try {
      const result = await githubCircuitBreaker.execute(async () => {
        return retryWithBackoff(
          async () => {
            const response = await fetch(url, {
              headers: buildGitHubHeaders(),
            });

            if (!response.ok) {
              // Fallback to first trusted version if API fails (never use main/master)
              logger.warn('Failed to fetch default branch, using trusted version fallback', {
                status: response.status,
                owner,
                repo,
              });
              const trusted = getTrustedVersions(owner, repo);
              return trusted.length > 0 ? trusted[0] : 'v6.1';
            }

            const data = await response.json();
            let defaultBranch = data.default_branch || 'v6.1';

            // Never use main/master - replace with trusted version if detected
            if (isUnstableBranch(defaultBranch)) {
              const trusted = getTrustedVersion(owner, repo);
              defaultBranch = trusted || 'v6.1';
              logger.info('Replaced unstable default branch with trusted version', {
                owner,
                repo,
                original: data.default_branch,
                replacement: defaultBranch,
              });
            }

            // Cache the result
            await setCachedData(cacheKey, defaultBranch);
            logger.info('Default branch fetched and cached', { owner, repo, defaultBranch });

            return defaultBranch;
          },
          {
            maxRetries: 2,
            initialDelay: 500,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying default branch fetch (attempt ${attempt})`, {
                error: error.message,
              });
            },
          }
        );
      });

      if (result.success && result.data) {
        return result.data;
      }

      // Fallback on failure
      logger.warn('Default branch fetch failed, using trusted version fallback', { owner, repo });
      const trusted = getTrustedVersion(owner, repo);
      return trusted || 'v6.1';
    } catch (error) {
      logger.error(
        'Error fetching default branch',
        error instanceof Error ? error : new Error(String(error)),
        {
          owner,
          repo,
        }
      );
      // Fallback to common defaults on error
      return 'main';
    }
  });
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
 * Fetch available branches from GitHub API
 */
export async function fetchBranches(): Promise<GitHubTag[]> {
  return logger.measure('fetchBranches', async () => {
    const cacheKey = getCacheKey(
      currentConfig.owner,
      currentConfig.repo,
      currentConfig.branch,
      '',
      'branches'
    );

    // Try cache first
    const cached = await getCachedData<GitHubTag[]>(cacheKey);
    if (cached) {
      logger.debug('Branches cache hit', { owner: currentConfig.owner, repo: currentConfig.repo });
      return cached;
    }

    const url = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/branches?per_page=100`;
    logger.debug('Fetching branches', {
      owner: currentConfig.owner,
      repo: currentConfig.repo,
      url,
    });

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
                logger.error('Rate limit exceeded', error, { rateLimitRemaining, rateLimitReset });
                throw error;
              }

              const error = new GitHubApiError(
                `Failed to fetch branches: ${response.statusText}`,
                response.status
              );
              logger.error('Failed to fetch branches', error, { status: response.status });
              throw error;
            }

            const data = await response.json();
            const branches = Array.isArray(data) ? data : [];

            // Transform branch data to match GitHubTag format
            const transformedBranches: GitHubTag[] = branches.map(
              (branch: { name: string; commit: { sha: string; url: string } }) => ({
                name: branch.name,
                commit: branch.commit,
                zipball_url: '',
                tarball_url: '',
                node_id: '',
              })
            );

            // Cache the result
            await setCachedData(cacheKey, transformedBranches);
            logger.info('Branches fetched and cached', {
              owner: currentConfig.owner,
              repo: currentConfig.repo,
              count: transformedBranches.length,
            });

            return transformedBranches;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying branch fetch (attempt ${attempt})`, { error: error.message });
            },
          }
        );
      });

      if (result.success && result.data) {
        return result.data;
      }

      throw result.error || new GitHubApiError('Failed to fetch branches after retries');
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      const apiError = new GitHubApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      logger.error('Error fetching branches', apiError);
      throw apiError;
    }
  });
}

/**
 * Get trusted branches as GitHubTag[] format for UI display
 * This creates GitHubTag objects from the hardcoded trusted versions
 */
export function getTrustedBranches(owner: string, repo: string): GitHubTag[] {
  const trusted = getTrustedVersions(owner, repo);
  return trusted.map((name) => ({
    name,
    commit: { sha: '', url: '' },
    zipball_url: '',
    tarball_url: '',
    node_id: '',
  }));
}

/**
 * Filter branches to only include trusted versions
 * Main/master branches are always excluded as they are unstable
 * @deprecated Use getTrustedBranches instead - this function is kept for backward compatibility
 */
export function filterStableBranches(
  branches: GitHubTag[],
  owner?: string,
  repo?: string
): GitHubTag[] {
  // Always filter out main/master branches first
  const filtered = branches.filter((branch) => !isUnstableBranch(branch.name));

  if (!owner || !repo) {
    return filtered;
  }

  const trusted = getTrustedVersions(owner, repo);
  if (trusted.length === 0) {
    // No trusted versions configured, return filtered branches (without main/master)
    return filtered;
  }

  // Filter to only include trusted versions (which never include main/master) and sort by trusted order
  return filtered
    .filter((branch) => trusted.includes(branch.name))
    .sort((a, b) => {
      // Sort by trusted order (first in array is preferred)
      const indexA = trusted.indexOf(a.name);
      const indexB = trusted.indexOf(b.name);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
}

/**
 * Fetch available kernel versions (tags) from GitHub
 */
export async function fetchKernelVersions(): Promise<GitHubTag[]> {
  return logger.measure('fetchKernelVersions', async () => {
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
      logger.debug('Kernel versions cache hit', {
        owner: currentConfig.owner,
        repo: currentConfig.repo,
      });
      return cached;
    }

    const url = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/tags?per_page=100`;
    logger.debug('Fetching kernel versions', {
      owner: currentConfig.owner,
      repo: currentConfig.repo,
      url,
    });

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
                logger.error('Rate limit exceeded', error, { rateLimitRemaining, rateLimitReset });
                throw error;
              }

              const error = new GitHubApiError(
                `Failed to fetch kernel versions: ${response.statusText}`,
                response.status
              );
              logger.error('Failed to fetch kernel versions', error, { status: response.status });
              throw error;
            }

            const data = await response.json();
            const versions = Array.isArray(data) ? data : [];

            // Cache the result
            await setCachedData(cacheKey, versions);
            logger.info('Kernel versions fetched and cached', {
              owner: currentConfig.owner,
              repo: currentConfig.repo,
              count: versions.length,
            });

            return versions;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying kernel versions fetch (attempt ${attempt})`, {
                error: error.message,
              });
            },
          }
        );
      });

      if (result.success && result.data) {
        return result.data;
      }

      throw result.error || new GitHubApiError('Failed to fetch kernel versions after retries');
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      const apiError = new GitHubApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      logger.error('Error fetching kernel versions', apiError);
      throw apiError;
    }
  });
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
  logger.debug('Trying trusted versions', { owner, repo, currentBranch });

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
        logger.info(
          `Branch "${currentBranch}" not found, using trusted version "${version}" instead`,
          {
            owner,
            repo,
            originalBranch: currentBranch,
            trustedBranch: version,
          }
        );
        return version;
      }
    } catch (error) {
      logger.debug(`Trusted version "${version}" not available`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to next version
      continue;
    }
  }

  logger.warn('No trusted versions found', { owner, repo, currentBranch });
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
    logger.debug('Failed to fetch from local storage, will try GitHub API', {
      error: error instanceof Error ? error.message : String(error),
    });
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
    logger.debug('Failed to fetch file from local storage, will try GitHub API', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null; // Fall back to GitHub API
  }
}

/**
 * Fetch directory contents from local storage first, then GitHub API as fallback
 */
export async function fetchDirectoryContents(path: string = ''): Promise<GitHubApiResponse[]> {
  return logger.measure('fetchDirectoryContents', async () => {
    // Validate configuration
    if (!currentConfig.owner || !currentConfig.repo) {
      const error = new GitHubApiError(
        `Repository not configured. Please set owner and repo before fetching directory contents.`,
        400
      );
      logger.error('Repository not configured', error);
      throw error;
    }

    // Validate branch is the trusted version
    const trusted = getTrustedVersion(currentConfig.owner, currentConfig.repo);
    if (trusted && trusted !== currentConfig.branch) {
      const error = new GitHubApiError(
        `Invalid branch "${currentConfig.branch}" for ${currentConfig.owner}/${currentConfig.repo}. Only trusted version is allowed: ${trusted}`,
        400
      );
      logger.error('Invalid branch for repository', error);
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
      logger.debug('Directory contents fetched from local storage', {
        path,
        owner: currentConfig.owner,
        repo: currentConfig.repo,
        count: storageResult.length,
      });
      return storageResult;
    }

    // If not in local storage, try on-demand download
    const identifier = getGitHubRepoIdentifier(currentConfig.owner, currentConfig.repo);
    const metadata = await getDirectoryMetadata('github', identifier, currentConfig.branch, path);
    if (!metadata) {
      // Directory metadata doesn't exist - download it on-demand
      logger.info('Directory metadata not available, downloading on-demand', {
        path,
        owner: currentConfig.owner,
        repo: currentConfig.repo,
      });
      try {
        const entries = await downloadDirectoryContents(
          currentConfig.owner,
          currentConfig.repo,
          currentConfig.branch,
          path
        );
        // Convert to GitHub API format
        const result = entries.map((entry) => convertFileEntryToGitHubResponse(entry, path));
        logger.info('Directory downloaded on-demand successfully', {
          path,
          count: result.length,
        });
        return result;
      } catch (error) {
        logger.warn('Failed to download directory on-demand, falling back to API', {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
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
      logger.debug('Directory contents cache hit', {
        path,
        owner: currentConfig.owner,
        repo: currentConfig.repo,
      });
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

    logger.debug('Fetching directory contents', {
      path,
      url,
      owner: currentConfig.owner,
      repo: currentConfig.repo,
    });

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
                logger.error('Rate limit exceeded', error, {
                  rateLimitRemaining,
                  rateLimitReset,
                  path,
                });
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
                    logger.info('Branch not found, trying trusted version', {
                      originalBranch: currentConfig.branch,
                      trustedBranch: validBranch,
                      path,
                    });

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
                      logger.info('Directory contents fetched with trusted branch', {
                        path,
                        branch: validBranch,
                      });

                      return contents;
                    } else {
                      // Retry failed, try to get error message
                      let retryErrorMessage = retryResponse.statusText;
                      try {
                        const retryErrorData = await retryResponse.json().catch(() => null);
                        if (retryErrorData?.message) {
                          retryErrorMessage = retryErrorData.message;
                        }
                      } catch {
                        // Ignore
                      }
                      logger.warn(`Retry with branch "${validBranch}" also failed`, {
                        error: retryErrorMessage,
                      });
                    }
                  } else {
                    logger.warn('Could not find any trusted learning version', {
                      owner: currentConfig.owner,
                      repo: currentConfig.repo,
                    });
                  }
                } catch (retryError) {
                  // If retry fails, fall through to original error
                  logger.error(
                    'Failed to retry with trusted version',
                    retryError instanceof Error ? retryError : new Error(String(retryError))
                  );
                }
              }

              const pathDisplay = path || 'root';
              const error = new GitHubApiError(
                `Failed to fetch directory "${pathDisplay}": ${errorMessage}`,
                response.status
              );
              logger.error('Failed to fetch directory', error, { path, status: response.status });
              throw error;
            }

            const data = await response.json();
            const contents = Array.isArray(data) ? data : [];

            // Cache the result
            await setCachedData(cacheKey, contents);
            logger.info('Directory contents fetched and cached', { path, count: contents.length });

            return contents;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying directory fetch (attempt ${attempt})`, {
                error: error.message,
                path,
              });
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
      logger.error('Error fetching directory contents', apiError, { path });
      throw apiError;
    }
  });
}

/**
 * Fetch file content from local storage first, then GitHub API as fallback
 */
export async function fetchFileContent(path: string): Promise<string> {
  return logger.measure('fetchFileContent', async () => {
    // Validate configuration
    if (!currentConfig.owner || !currentConfig.repo) {
      const error = new GitHubApiError(
        `Repository not configured. Please set owner and repo before fetching file content.`,
        400
      );
      logger.error('Repository not configured', error);
      throw error;
    }

    if (!path) {
      const error = new GitHubApiError(`File path is required`, 400);
      logger.error('File path required', error);
      throw error;
    }

    // Validate branch is the trusted version
    const trusted = getTrustedVersion(currentConfig.owner, currentConfig.repo);
    if (trusted && trusted !== currentConfig.branch) {
      const error = new GitHubApiError(
        `Invalid branch "${currentConfig.branch}" for ${currentConfig.owner}/${currentConfig.repo}. Only trusted version is allowed: ${trusted}`,
        400
      );
      logger.error('Invalid branch for repository', error);
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
      logger.debug('File content fetched from local storage', {
        path,
        owner: currentConfig.owner,
        repo: currentConfig.repo,
        size: storageResult.length,
      });
      return storageResult;
    }

    // Check if file is available in storage - if not, download on-demand
    const identifier = getGitHubRepoIdentifier(currentConfig.owner, currentConfig.repo);
    const fileAvailable = await isFileAvailable('github', identifier, currentConfig.branch, path);

    if (!fileAvailable) {
      // File is not downloaded - download it on-demand (lazy loading)
      logger.info('File not available locally, downloading on-demand', {
        path,
        owner: currentConfig.owner,
        repo: currentConfig.repo,
      });
      try {
        const content = await downloadFileFromGitHub(
          currentConfig.owner,
          currentConfig.repo,
          currentConfig.branch,
          path
        );
        logger.info('File downloaded on-demand successfully', {
          path,
          size: content.length,
        });
        return content;
      } catch (error) {
        logger.warn('Failed to download file on-demand, falling back to API', {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
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
      logger.debug('File content cache hit', {
        path,
        owner: currentConfig.owner,
        repo: currentConfig.repo,
      });
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

    logger.debug('Fetching file content', {
      path,
      url,
      owner: currentConfig.owner,
      repo: currentConfig.repo,
    });

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
                logger.error('Rate limit exceeded', error, {
                  rateLimitRemaining,
                  rateLimitReset,
                  path,
                });
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
                    logger.info('Branch not found, trying trusted version', {
                      originalBranch: currentConfig.branch,
                      trustedBranch: validBranch,
                      path,
                    });

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
                      logger.info('File content fetched with trusted branch', {
                        path,
                        branch: validBranch,
                      });

                      return content;
                    } else {
                      // Retry failed, try to get error message
                      let retryErrorMessage = retryResponse.statusText;
                      try {
                        const retryErrorData = await retryResponse.json().catch(() => null);
                        if (retryErrorData?.message) {
                          retryErrorMessage = retryErrorData.message;
                        }
                      } catch {
                        // Ignore
                      }
                      logger.warn(`Retry with branch "${validBranch}" also failed`, {
                        error: retryErrorMessage,
                      });
                    }
                  } else {
                    logger.warn('Could not find any trusted learning version', {
                      owner: currentConfig.owner,
                      repo: currentConfig.repo,
                    });
                  }
                } catch (retryError) {
                  // If retry fails, fall through to original error
                  logger.error(
                    'Failed to retry with trusted version',
                    retryError instanceof Error ? retryError : new Error(String(retryError))
                  );
                }
              }

              const error = new GitHubApiError(
                `Failed to fetch file "${path}": ${errorMessage}`,
                response.status
              );
              logger.error('Failed to fetch file', error, { path, status: response.status });
              throw error;
            }

            const data: GitHubApiResponse = await response.json();

            if (data.type === 'dir') {
              const error = new GitHubApiError(`Path is a directory, not a file: ${path}`);
              logger.error('Path is directory, not file', error, { path });
              throw error;
            }

            if (data.type !== 'file' || !data.content) {
              const error = new GitHubApiError(
                `Invalid file response from GitHub API - File: ${path}`
              );
              logger.error('Invalid file response', error, { path });
              throw error;
            }

            // Decode base64 content
            const content =
              data.encoding === 'base64' ? atob(data.content.replace(/\n/g, '')) : data.content;

            // Cache the result
            await setCachedData(cacheKey, content);
            logger.info('File content fetched and cached', { path, size: content.length });

            return content;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying file fetch (attempt ${attempt})`, {
                error: error.message,
                path,
              });
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
      logger.error('Error fetching file content', apiError, { path });
      throw apiError;
    }
  });
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

/**
 * Fetch a pull request by number
 */
export async function fetchPullRequest(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequest> {
  return logger.measure('fetchPullRequest', async () => {
    const cacheKey = getCacheKey(owner, repo, 'main', '', `pr-${prNumber}`);

    // Try cache first
    const cached = await getCachedData<PullRequest>(cacheKey);
    if (cached) {
      logger.debug('Pull request cache hit', { owner, repo, prNumber });
      return cached;
    }

    const url = `${currentConfig.apiBase}/${owner}/${repo}/pulls/${prNumber}`;
    logger.debug('Fetching pull request', { owner, repo, prNumber, url });

    try {
      const result = await githubCircuitBreaker.execute(async () => {
        return retryWithBackoff(
          async () => {
            const response = await fetch(url, {
              headers: buildGitHubHeaders(),
            });

            if (!response.ok) {
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
                logger.error('Rate limit exceeded', error, { rateLimitRemaining, rateLimitReset });
                throw error;
              }

              const error = new GitHubApiError(
                `Failed to fetch pull request: ${response.statusText}`,
                response.status
              );
              logger.error('Failed to fetch pull request', error, { status: response.status });
              throw error;
            }

            const data = await response.json();
            await setCachedData(cacheKey, data);
            logger.info('Pull request fetched and cached', { owner, repo, prNumber });

            return data;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying pull request fetch (attempt ${attempt})`, {
                error: error.message,
              });
            },
          }
        );
      });

      if (result.success && result.data) {
        return result.data;
      }

      throw new GitHubApiError('Failed to fetch pull request', 500);
    } catch (error) {
      logger.error(
        'Error fetching pull request',
        error instanceof Error ? error : new Error(String(error)),
        { owner, repo, prNumber }
      );
      throw error;
    }
  });
}

/**
 * Fetch files changed in a pull request
 */
export async function fetchPullRequestFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequestFile[]> {
  return logger.measure('fetchPullRequestFiles', async () => {
    const cacheKey = getCacheKey(owner, repo, 'main', '', `pr-${prNumber}-files`);

    // Try cache first
    const cached = await getCachedData<PullRequestFile[]>(cacheKey);
    if (cached) {
      logger.debug('Pull request files cache hit', { owner, repo, prNumber });
      return cached;
    }

    const url = `${currentConfig.apiBase}/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;
    logger.debug('Fetching pull request files', { owner, repo, prNumber, url });

    try {
      const result = await githubCircuitBreaker.execute(async () => {
        return retryWithBackoff(
          async () => {
            const response = await fetch(url, {
              headers: buildGitHubHeaders(),
            });

            if (!response.ok) {
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
                logger.error('Rate limit exceeded', error, { rateLimitRemaining, rateLimitReset });
                throw error;
              }

              const error = new GitHubApiError(
                `Failed to fetch pull request files: ${response.statusText}`,
                response.status
              );
              logger.error('Failed to fetch pull request files', error, {
                status: response.status,
              });
              throw error;
            }

            const data = await response.json();
            await setCachedData(cacheKey, data);
            logger.info('Pull request files fetched and cached', {
              owner,
              repo,
              prNumber,
              fileCount: data.length,
            });

            return data;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, error) => {
              logger.warn(`Retrying pull request files fetch (attempt ${attempt})`, {
                error: error.message,
              });
            },
          }
        );
      });

      if (result.success && result.data) {
        return result.data;
      }

      throw new GitHubApiError('Failed to fetch pull request files', 500);
    } catch (error) {
      logger.error(
        'Error fetching pull request files',
        error instanceof Error ? error : new Error(String(error)),
        { owner, repo, prNumber }
      );
      throw error;
    }
  });
}

/**
 * Parse a unified diff patch into structured hunks
 */
export function parseDiffPatch(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = patch.split('\n');
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldLines = parseInt(hunkMatch[2] || '1', 10);
      const newStart = parseInt(hunkMatch[3], 10);
      const newLines = parseInt(hunkMatch[4] || '1', 10);
      const heading = hunkMatch[5]?.trim() || '';

      currentHunk = {
        oldStart,
        oldLines,
        newStart,
        newLines,
        heading,
        lines: [],
      };
      oldLineNum = oldStart;
      newLineNum = newStart;
      continue;
    }

    if (!currentHunk) continue;

    // Context line
    if (line.startsWith(' ')) {
      currentHunk.lines.push({
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
        type: 'context',
        content: line.substring(1),
      });
    }
    // Removed line
    else if (line.startsWith('-')) {
      currentHunk.lines.push({
        oldLineNumber: oldLineNum++,
        newLineNumber: null,
        type: 'removed',
        content: line.substring(1),
      });
    }
    // Added line
    else if (line.startsWith('+')) {
      currentHunk.lines.push({
        oldLineNumber: null,
        newLineNumber: newLineNum++,
        type: 'added',
        content: line.substring(1),
      });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Fetch and parse pull request diff for a specific file
 */
export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  prNumber: number,
  filename: string
): Promise<PullRequestDiff | null> {
  const files = await fetchPullRequestFiles(owner, repo, prNumber);
  const file = files.find((f) => f.filename === filename);

  if (!file || !file.patch) {
    return null;
  }

  const hunks = parseDiffPatch(file.patch);

  return {
    file,
    hunks,
  };
}
