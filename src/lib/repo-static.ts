// Static file reader for curated repositories.
// In local dev this resolves to /public/repos/; in production curated files
// are typically fetched from a direct public bucket/custom-domain origin.

import type { FileNode } from '@/types';
import { buildCuratedRepoUrl } from './curated-content-url';
import { isCuratedRepo as isConfiguredCuratedRepo } from './curated-repos';
import { logFileFetchDebugInfo, type FileFetchResult } from './file-fetch-debug';
import { debugLog } from './browser-debug';

const STATIC_FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), STATIC_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Timed out after ${STATIC_FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

/**
 * Check if a repository is curated (pre-downloaded at build time)
 */
export function isCuratedRepo(owner: string, repo: string): boolean {
  return isConfiguredCuratedRepo(owner, repo);
}

/**
 * Get repository mode: curated (static files)
 */
export function getRepositoryMode(owner: string, repo: string): 'curated' {
  if (!isCuratedRepo(owner, repo)) {
    throw new Error(`Repository ${owner}/${repo} is not curated`);
  }

  return 'curated';
}

const getStaticFilePath = (owner: string, repo: string, branch: string, filePath: string) =>
  buildCuratedRepoUrl(owner, repo, branch, filePath);

function getStaticFileCandidates(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Array<{ url: string; resolvedSource: 'r2-bucket' }> {
  const candidates: Array<{ url: string; resolvedSource: 'r2-bucket' }> = [
    {
      url: getStaticFilePath(owner, repo, branch, filePath),
      resolvedSource: 'r2-bucket',
    },
  ];

  return candidates;
}

/**
 * Read file content from static files
 */
export async function readFileFromStatic(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<FileFetchResult> {
  const candidates = getStaticFileCandidates(owner, repo, branch, filePath);

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      debugLog('[explorar:file-fetch-static] start', {
        owner,
        repo,
        branch,
        filePath,
        source: 'r2-bucket',
        resolvedSource: candidate.resolvedSource,
        url: candidate.url,
      });
      const response = await fetchWithTimeout(candidate.url);

      if (!response.ok) {
        debugLog('[explorar:file-fetch-static] response-error', {
          owner,
          repo,
          branch,
          filePath,
          source: 'r2-bucket',
          resolvedSource: candidate.resolvedSource,
          url: candidate.url,
          status: response.status,
          statusText: response.statusText,
        });
        if (response.status === 404) {
          throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(`Failed to read file: ${response.statusText}`);
      }

      const content = await response.text();
      debugLog('[explorar:file-fetch-static] success', {
        owner,
        repo,
        branch,
        filePath,
        source: 'r2-bucket',
        resolvedSource: candidate.resolvedSource,
        url: candidate.url,
        contentLength: content.length,
      });

      const result: FileFetchResult = {
        content,
        debugInfo: {
          enabled: true,
          source: 'r2-bucket',
          requestUrl: candidate.url,
          responseUrl: response.url || undefined,
          responseStatus: response.status,
          cacheStatus: response.headers.get('cf-cache-status'),
          r2Key: response.headers.get('x-explorar-r2-key'),
          contentLength: response.headers.get('content-length'),
        },
      };

      logFileFetchDebugInfo(result.debugInfo);
      return result;
    } catch (error) {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(`Failed to read file from static storage: ${filePath}`);
      lastError = normalizedError;
      debugLog('[explorar:file-fetch-static] error', {
        owner,
        repo,
        branch,
        filePath,
        source: 'r2-bucket',
        resolvedSource: candidate.resolvedSource,
        url: candidate.url,
        error: normalizedError.message,
      });
    }
  }

  throw lastError ?? new Error(`Failed to read file from static storage: ${filePath}`);
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
  const manifestFileNames = ['repo-manifest.json', '.repo-manifest.json'];

  for (const manifestFileName of manifestFileNames) {
    const candidates = getStaticFileCandidates(owner, repo, branch, manifestFileName);

    for (const candidate of candidates) {
      try {
        const response = await fetchWithTimeout(candidate.url);

        if (response.ok) {
          const manifest = await response.json();
          const rawTree: ManifestNode[] | null = manifest.tree || null;
          if (!rawTree) return null;

          debugLog('[explorar:manifest-fetch-static] success', {
            owner,
            repo,
            branch,
            source: 'r2-bucket',
            resolvedSource: candidate.resolvedSource,
            url: candidate.url,
          });

          // New compact format uses short type keys ('f'/'d'); legacy format uses full FileNode shape
          const isCompact =
            rawTree.length > 0 && (rawTree[0].type === 'f' || rawTree[0].type === 'd');
          return isCompact ? expandManifestNodes(rawTree) : (rawTree as unknown as FileNode[]);
        }

        debugLog('[explorar:manifest-fetch-static] response-error', {
          owner,
          repo,
          branch,
          source: 'r2-bucket',
          resolvedSource: candidate.resolvedSource,
          url: candidate.url,
          status: response.status,
          statusText: response.statusText,
        });
      } catch (error) {
        debugLog('[explorar:manifest-fetch-static] error', {
          owner,
          repo,
          branch,
          source: 'r2-bucket',
          resolvedSource: candidate.resolvedSource,
          url: candidate.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Return null silently - missing manifests are expected for branches that weren't downloaded
  return null;
}
