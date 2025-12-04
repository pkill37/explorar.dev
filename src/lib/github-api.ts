// GitHub API utilities for fetching source code from GitHub repositories

import { GitHubApiResponse, FileNode, GitHubTag, GITHUB_CONFIG } from '@/types';
import { getCacheKey, getCachedData, setCachedData } from './github-cache';
import { retryWithBackoff, githubCircuitBreaker } from './github-retry';
import { logger } from './github-debug';

type GitHubConfig = {
  owner: string;
  repo: string;
  branch: string;
  apiBase: string;
  rawBase: string;
};

let currentConfig: GitHubConfig = { ...GITHUB_CONFIG };

/**
 * Trusted kernel versions recommended for learning
 * One LTS version from each major series (4.x, 5.x, 6.x)
 * These are well-documented and reliable versions suitable for learning
 */
const TRUSTED_LEARNING_VERSIONS = [
  'v6.1', // 6.x LTS - Very stable, recommended for learning
  'v5.15', // 5.x LTS - Well-established
  'v4.19', // 4.x LTS - Long-term support
] as const;

export function setGitHubRepo(owner: string, repo: string, branch: string = 'v6.1') {
  currentConfig = { ...currentConfig, owner, repo, branch };
}

/**
 * Set GitHub repository and automatically detect default branch if 'master' or unstable branch is specified
 */
export async function setGitHubRepoWithDefaultBranch(
  owner: string,
  repo: string,
  branch: string = 'v6.1'
): Promise<void> {
  // If branch is 'master' or 'main', use a stable branch instead
  if (branch === 'master' || branch === 'main') {
    // Use stable branch instead of potentially unstable default
    currentConfig = { ...currentConfig, owner, repo, branch: 'v6.1' };
    return;
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
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Explorar.dev',
              },
            });

            if (!response.ok) {
              // Fallback to common defaults if API fails
              logger.warn('Failed to fetch default branch, using fallback', {
                status: response.status,
                owner,
                repo,
              });
              return 'main';
            }

            const data = await response.json();
            const defaultBranch = data.default_branch || 'main';

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
      logger.warn('Default branch fetch failed, using fallback', { owner, repo });
      return 'main';
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
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Explorar.dev',
              },
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
 * Filter branches to only include stable 4.x, 5.x, and 6.x branches
 * Recommended stable branches:
 * - 4.x: linux-4.19.y (LTS)
 * - 5.x: linux-5.4.y (LTS), linux-5.10.y (LTS), linux-5.15.y (LTS)
 * - 6.x: linux-6.1.y (LTS - very stable), linux-6.6.y, linux-6.8.y
 */
export function filterStableBranches(branches: GitHubTag[]): GitHubTag[] {
  // Patterns for stable branches
  const stablePatterns = [
    // 4.x series - focus on LTS branches
    /^v4\.(19|20)/,

    // 5.x series - focus on LTS branches
    /^v5\.(4|10|15)/,

    // 6.x series - focus on stable branches, especially 6.1 (LTS)
    /^v6\.(1|6|8)/,
  ];

  return branches
    .filter((branch) => {
      const name = branch.name;
      return stablePatterns.some((pattern) => pattern.test(name));
    })
    .sort((a, b) => {
      // Sort by version number (newer first)
      const extractVersion = (name: string): number[] => {
        const match = name.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
        if (!match) return [0, 0, 0];
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3] || '0', 10)];
      };

      const versionA = extractVersion(a.name);
      const versionB = extractVersion(b.name);

      // Compare major, minor, patch
      for (let i = 0; i < 3; i++) {
        if (versionA[i] !== versionB[i]) {
          return versionB[i] - versionA[i]; // Descending order
        }
      }
      return 0;
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
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Explorar.dev',
              },
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
  for (const version of TRUSTED_LEARNING_VERSIONS) {
    // Skip if it's the same as the current branch (already tried)
    if (version === currentBranch) {
      continue;
    }

    // Quick check: try to fetch the root directory to see if branch exists
    try {
      const testUrl = `${currentConfig.apiBase}/${owner}/${repo}/contents?ref=${encodeURIComponent(version)}`;
      const testResponse = await fetch(testUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Linux-Kernel-Explorer',
        },
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
 * Fetch directory contents from GitHub API
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
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Explorar.dev',
              },
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
 * Fetch file content from GitHub API
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
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Explorar.dev',
              },
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
