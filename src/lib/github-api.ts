// GitHub API utilities for fetching source code from GitHub repositories

import { GitHubApiResponse, FileNode, GITHUB_CONFIG } from '@/types';
import { getGitHubRepoIdentifier, isFileAvailable, getTreeStructure } from './repo-storage';
import { readFileFromStatic, getTreeStructureFromStatic, getRepositoryMode } from './repo-static';
import { getHttpClient, isWebPlatform } from './platform';
import { storeTreeStructure } from './repo-storage';

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
  'golang/go': 'go1.22.0',
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
 * Fetch full tree metadata for arbitrary GitHub repositories
 * Uses GitHub API with recursive tree endpoint to get complete file structure
 */
export async function fetchFullTreeMetadata(
  owner: string,
  repo: string,
  branch: string
): Promise<FileNode[]> {
  try {
    // First, get the branch SHA
    const branchUrl = `${currentConfig.apiBase}/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
    const headers = buildGitHubHeaders();

    let branchResponse: Response;
    if (isWebPlatform()) {
      try {
        const httpClient = getHttpClient();
        branchResponse = await httpClient.get(branchUrl, headers as Record<string, string>);
      } catch {
        branchResponse = await fetch(branchUrl, { headers });
      }
    } else {
      branchResponse = await fetch(branchUrl, { headers });
    }

    if (!branchResponse.ok) {
      throw new GitHubApiError(
        `Failed to fetch branch: ${branchResponse.statusText}`,
        branchResponse.status
      );
    }

    const branchData = await branchResponse.json();
    const treeSha = branchData.commit?.sha;

    if (!treeSha) {
      throw new GitHubApiError('Failed to get tree SHA from branch', 500);
    }

    // Fetch recursive tree
    const treeUrl = `${currentConfig.apiBase}/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
    let treeResponse: Response;
    if (isWebPlatform()) {
      try {
        const httpClient = getHttpClient();
        treeResponse = await httpClient.get(treeUrl, headers as Record<string, string>);
      } catch {
        treeResponse = await fetch(treeUrl, { headers });
      }
    } else {
      treeResponse = await fetch(treeUrl, { headers });
    }

    if (!treeResponse.ok) {
      throw new GitHubApiError(
        `Failed to fetch tree: ${treeResponse.statusText}`,
        treeResponse.status
      );
    }

    const treeData = await treeResponse.json();
    const tree = treeData.tree || [];

    // Convert GitHub tree format to FileNode structure
    const fileNodes: FileNode[] = [];
    const nodeMap = new Map<string, FileNode>();

    // First pass: create all nodes
    for (const item of tree) {
      const pathParts = item.path.split('/').filter(Boolean);
      const node: FileNode = {
        name: pathParts[pathParts.length - 1],
        path: item.path,
        type: item.type === 'tree' ? 'directory' : 'file',
        size: item.size || 0,
        isExpanded: false,
        isLoaded: false,
      };

      nodeMap.set(item.path, node);
    }

    // Second pass: build tree structure
    for (const item of tree) {
      const node = nodeMap.get(item.path);
      if (!node) continue;

      const pathParts = item.path.split('/').filter(Boolean);
      if (pathParts.length === 1) {
        // Root level
        fileNodes.push(node);
      } else {
        // Find parent
        const parentPath = pathParts.slice(0, -1).join('/');
        const parent = nodeMap.get(parentPath);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      }
    }

    // Store tree structure in IndexedDB
    const identifier = getGitHubRepoIdentifier(owner, repo);
    await storeTreeStructure('github', identifier, branch, fileNodes);

    return fileNodes;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(
      `Failed to fetch full tree metadata: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}

/**
 * Fetch file content from local storage first, then GitHub API as fallback
 * Supports both curated (static files) and arbitrary (GitHub API) repos
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

  const mode = getRepositoryMode(currentConfig.owner, currentConfig.repo);

  // For curated repos, use static files
  if (mode === 'curated') {
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

    // If static files don't have it, provide helpful error
    const repoKey = `${currentConfig.owner}/${currentConfig.repo}`;
    const isDevMode = process.env.NODE_ENV === 'development';

    throw new GitHubApiError(
      `Repository not downloaded: ${repoKey}\n\n` +
        `The file "${path}" cannot be loaded because the repository hasn't been downloaded.\n\n` +
        (isDevMode
          ? `To download this repository:\n` +
            `1. Stop the dev server (Ctrl+C)\n` +
            `2. Run: tsx scripts/download-repos.ts --only=${repoKey} --depth=1\n` +
            `3. Restart the dev server: npm run dev\n\n` +
            `Alternatively, download all repos: npm run prebuild`
          : `This repository needs to be downloaded during the build process.\n` +
            `Run: npm run build`),
      404
    );
  }

  // For arbitrary repos, use GitHub API with auth
  try {
    const fileUrl = `${currentConfig.apiBase}/${currentConfig.owner}/${currentConfig.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(currentConfig.branch)}`;
    const headers = buildGitHubHeaders();

    let response: Response;
    if (isWebPlatform()) {
      try {
        const httpClient = getHttpClient();
        response = await httpClient.get(fileUrl, headers as Record<string, string>);
      } catch {
        response = await fetch(fileUrl, { headers });
      }
    } else {
      response = await fetch(fileUrl, { headers });
    }

    if (!response.ok) {
      throw new GitHubApiError(`Failed to fetch file: ${response.statusText}`, response.status);
    }

    const fileData: GitHubApiResponse = await response.json();

    if (fileData.type !== 'file') {
      throw new GitHubApiError(`Path is not a file: ${path}`, 400);
    }

    // Decode base64 content
    if (fileData.content && fileData.encoding === 'base64') {
      const content = atob(fileData.content.replace(/\n/g, ''));

      // Store in IndexedDB for future use
      const identifier = getGitHubRepoIdentifier(currentConfig.owner, currentConfig.repo);
      const { storeFileInStorage } = await import('./repo-storage');
      await storeFileInStorage('github', identifier, currentConfig.branch, path, content);

      return content;
    }

    throw new GitHubApiError(`File content not available in expected format: ${path}`, 500);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(
      `Failed to fetch file content: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
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
 * Build file tree from static files, stored tree structure, or GitHub API
 * Supports both curated (static) and arbitrary (GitHub API) repos
 */
export async function buildFileTree(path: string = ''): Promise<FileNode[]> {
  try {
    const { owner, repo, branch } = currentConfig;
    const mode = getRepositoryMode(owner, repo);

    // For curated repos, use static files
    if (mode === 'curated') {
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

    // For arbitrary repos, use IndexedDB storage or fetch from GitHub API
    const identifier = getGitHubRepoIdentifier(owner, repo);

    // First, try to get complete tree structure from storage
    let completeTree = await getTreeStructure('github', identifier, branch);

    // If not in storage, fetch full tree metadata from GitHub API
    if (!completeTree || completeTree.length === 0) {
      try {
        completeTree = await fetchFullTreeMetadata(owner, repo, branch);
      } catch (error) {
        console.error('Failed to fetch full tree metadata:', error);
        // Return empty tree if fetch fails
        return [];
      }
    }

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

    // Fallback: return empty tree
    return [];
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
