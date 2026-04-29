// Static file reader for build-time downloaded repositories
// Reads from public/repos/ directory using fetch (works with static export)

import type { FileNode } from '@/types';
import { isCuratedRepo as isConfiguredCuratedRepo } from './curated-repos';

/**
 * Check if a repository is curated (pre-downloaded at build time)
 */
export function isCuratedRepo(owner: string, repo: string): boolean {
  return isConfiguredCuratedRepo(owner, repo);
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

// Compact node format stored in manifest (short keys, no path/size)
interface ManifestNode {
  name: string;
  type: 'f' | 'd';
  children?: ManifestNode[];
}

function expandManifestNodes(nodes: ManifestNode[], parentPath: string = ''): FileNode[] {
  return nodes.map((node) => {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const expanded: FileNode = {
      name: node.name,
      path: nodePath,
      type: node.type === 'd' ? 'directory' : 'file',
    };
    if (node.children) {
      expanded.children = expandManifestNodes(node.children, nodePath);
    }
    return expanded;
  });
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
        const rawTree: ManifestNode[] | null = manifest.tree || null;
        if (!rawTree) return null;
        // New compact format uses short type keys ('f'/'d'); legacy format uses full FileNode shape
        const isCompact =
          rawTree.length > 0 && (rawTree[0].type === 'f' || rawTree[0].type === 'd');
        return isCompact ? expandManifestNodes(rawTree) : (rawTree as unknown as FileNode[]);
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
