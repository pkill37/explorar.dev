// Static file reader for build-time downloaded repositories
// Reads from public/repos/ directory using fetch (works with static export)

import type { FileNode } from '@/types';
import { getProjectConfig } from './project-guides';

/**
 * Check if a repository is curated (pre-downloaded at build time)
 */
export function isCuratedRepo(owner: string, repo: string): boolean {
  return getProjectConfig(owner, repo) !== null;
}

/**
 * Get repository mode: curated (static files) or arbitrary (GitHub API)
 */
export function getRepositoryMode(owner: string, repo: string): 'curated' | 'arbitrary' {
  return isCuratedRepo(owner, repo) ? 'curated' : 'arbitrary';
}

/**
 * Get the static file path for a repository file
 */
function getStaticFilePath(owner: string, repo: string, branch: string, filePath: string): string {
  // Remove leading slash if present
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  return `/repos/${owner}/${repo}/${branch}/${cleanPath}`;
}

/**
 * Read file content from static files
 */
export async function readFileFromStatic(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string> {
  const url = getStaticFilePath(owner, repo, branch, filePath);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to read file from static storage: ${filePath}`);
  }
}

/**
 * List directory contents from static files
 * Uses tree structure from manifest to find directory contents
 */
export async function listDirectoryFromStatic(
  owner: string,
  repo: string,
  branch: string,
  dirPath: string = ''
): Promise<Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>> {
  // Get full tree structure
  const tree = await getTreeStructureFromStatic(owner, repo, branch);
  if (!tree) {
    return [];
  }

  // Find the directory in the tree
  const findDirectory = (nodes: FileNode[], targetPath: string): FileNode | null => {
    if (!targetPath) {
      // Return root level items
      return { name: '', path: '', type: 'directory', children: nodes } as FileNode;
    }

    const pathParts = targetPath.split('/').filter(Boolean);
    let current: FileNode | null = null;
    let currentNodes = nodes;

    for (const part of pathParts) {
      current = currentNodes.find((n) => n.name === part && n.type === 'directory') || null;
      if (!current || !current.children) {
        return null;
      }
      currentNodes = current.children;
    }

    return current;
  };

  const dir = findDirectory(tree, dirPath);
  if (!dir || !dir.children) {
    return [];
  }

  // Convert FileNode children to FileEntry format
  return dir.children.map((node) => ({
    name: node.name,
    path: node.path,
    type: node.type,
    size: node.size,
  }));
}

/**
 * Get tree structure from static files
 * Uses manifest file created during build
 */
export async function getTreeStructureFromStatic(
  owner: string,
  repo: string,
  branch: string
): Promise<FileNode[] | null> {
  // Only try to fetch manifest for curated repos
  if (!isCuratedRepo(owner, repo)) {
    return null;
  }

  // Try new manifest name first (repo-manifest.json), then fall back to old name (.repo-manifest.json)
  const manifestPaths = [
    getStaticFilePath(owner, repo, branch, 'repo-manifest.json'),
    getStaticFilePath(owner, repo, branch, '.repo-manifest.json'),
  ];

  for (const manifestPath of manifestPaths) {
    try {
      const response = await fetch(manifestPath);

      if (response.ok) {
        const manifest = await response.json();
        return manifest.tree || null;
      }

      // Silently continue on 404 (expected for branches that weren't downloaded)
      // Other errors are also handled silently to avoid noise
    } catch {
      // Network errors - silently continue
      // This is expected when branches don't exist or are not downloaded
      continue;
    }
  }

  // Return null silently - missing manifests are expected for branches that weren't downloaded
  return null;
}

/**
 * Check if a file exists in static storage
 */
export async function isFileAvailableInStatic(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<boolean> {
  const url = getStaticFilePath(owner, repo, branch, filePath);

  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
