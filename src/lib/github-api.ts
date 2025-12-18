// GitHub API utilities for fetching source code from GitHub repositories

import { GitHubApiResponse, FileNode, GITHUB_CONFIG } from '@/types';
import {
  getGitHubRepoIdentifier,
  FileEntry,
  isFileAvailable,
  getTreeStructure,
} from './repo-storage';
import {
  isCuratedRepo,
  readFileFromStatic,
  listDirectoryFromStatic,
  getTreeStructureFromStatic,
} from './repo-static';

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
async function _tryTrustedVersions(
  owner: string,
  repo: string,
  currentBranch: string
): Promise<string | null> {
  // Try trusted version
  const trusted = getTrustedVersion(owner, repo);
  if (trusted && trusted !== currentBranch) {
    // Quick check: try to fetch the root directory to see if branch exists
    try {
      const testUrl = `${currentConfig.apiBase}/${owner}/${repo}/contents?ref=${encodeURIComponent(trusted)}`;
      const testResponse = await fetch(testUrl, {
        headers: buildGitHubHeaders(),
      });

      if (testResponse.ok) {
        return trusted;
      }
    } catch (error) {
      console.error(`Error checking trusted version ${trusted}:`, error);
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
 * Try to fetch directory contents from static files (local filesystem served over HTTP)
 * Always uses static files - no fallback to GitHub API
 */
async function tryFetchFromStorage(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<GitHubApiResponse[] | null> {
  try {
    // Always try static files first (served from out/repos/ via HTTP)
    const staticEntries = await listDirectoryFromStatic(owner, repo, branch, path);
    if (staticEntries.length > 0) {
      return staticEntries.map((entry) => convertFileEntryToGitHubResponse(entry, path));
    }
    // If static files don't have it, return null
    return null;
  } catch (error) {
    console.error('Error fetching from storage:', error);
    return null;
  }
}

/**
 * Try to fetch file content from static files (local filesystem served over HTTP)
 * Always uses static files - no fallback to GitHub API
 */
async function tryFetchFileFromStorage(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | null> {
  try {
    // Always try static files first (served from out/repos/ via HTTP)
    try {
      return await readFileFromStatic(owner, repo, branch, path);
    } catch (error) {
      // File not found in static storage
      console.warn(`File not found in static storage: ${owner}/${repo}/${branch}/${path}`, error);
      return null;
    }
  } catch (error) {
    console.error('Error fetching file from storage:', error);
    return null;
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

  // Always try static files first (served from out/repos/ via HTTP)
  const storageResult = await tryFetchFromStorage(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path
  );
  if (storageResult) {
    return storageResult;
  }

  // If static files don't have it, it doesn't exist - throw error instead of falling back to GitHub API
  throw new GitHubApiError(`Directory not found in static storage: ${path}`, 404);
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

  // Always try static files first (served from out/repos/ via HTTP)
  const storageResult = await tryFetchFileFromStorage(
    currentConfig.owner,
    currentConfig.repo,
    currentConfig.branch,
    path
  );
  if (storageResult) {
    return storageResult;
  }

  // If static files don't have it, it doesn't exist - throw error instead of falling back to GitHub API
  throw new GitHubApiError(`File not found in static storage: ${path}`, 404);
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
 * Build file tree from static files, stored tree structure, or fallback to API
 */
export async function buildFileTree(path: string = ''): Promise<FileNode[]> {
  try {
    const { owner, repo, branch } = currentConfig;

    // Check if this is a curated repo (pre-downloaded at build time)
    if (isCuratedRepo(owner, repo)) {
      const staticTree = await getTreeStructureFromStatic(owner, repo, branch);
      if (staticTree && staticTree.length > 0) {
        // Extract subtree for requested path
        const subtree = extractSubtree(staticTree, path);

        // Mark all files as loaded (they're available in static files)
        const markAsLoaded = (nodes: FileNode[]): void => {
          for (const node of nodes) {
            if (node.type === 'file') {
              node.isLoaded = true;
            } else if (node.children) {
              markAsLoaded(node.children);
            }
          }
        };
        markAsLoaded(subtree);

        return subtree;
      }
    }

    // For non-curated repos, use IndexedDB storage
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
