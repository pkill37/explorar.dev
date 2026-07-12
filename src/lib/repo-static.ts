// Static file reader for curated repositories.
// In local dev this resolves to /public/repos/; in production curated files
// are typically fetched from a direct public bucket/custom-domain origin.

import type { FileNode } from '@/types';
import { buildCuratedRepoStaticPath, buildCuratedRepoUrl } from './curated-content-url';
import { isCuratedRepo as isConfiguredCuratedRepo } from './curated-repos';
import { logFileFetchDebugInfo, type FileFetchResult } from './file-fetch-debug';
import { debugLog } from './browser-debug';
import {
  CODE_INDEX_FILE_NAME,
  CODE_INDEX_VERSION,
  type CodeIndexDatabaseLike,
  type CodeIndexMetadata,
  type LoadedCodeIndex,
} from './code-index';

const STATIC_FETCH_TIMEOUT_MS = 5000;
const SEARCH_INDEX_FETCH_TIMEOUT_MS = 15000;
const codeIndexCache = new Map<string, Promise<LoadedCodeIndex | null>>();
const treeStructureCache = new Map<string, Promise<FileNode[] | null>>();
const codeIndexSizeCache = new Map<string, number>();
const codeIndexLoadSourceCache = new Map<string, CodeIndexLoadProgress['source']>();
const CODE_INDEX_BROWSER_CACHE_NAME = 'explorar-code-index-v1';

export interface CodeIndexLoadProgress {
  loadedBytes: number;
  totalBytes: number | null;
  source: 'cache' | 'network';
}

function getCodeIndexCacheKey(owner: string, repo: string, branch: string): string {
  return getStaticFilePath(owner, repo, branch, CODE_INDEX_FILE_NAME);
}

function getCodeIndexLoadKey(owner: string, repo: string, branch: string): string {
  return `${owner}/${repo}@${branch}`;
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

async function readCachedCodeIndexBytes(
  owner: string,
  repo: string,
  branch: string,
  onProgress?: (progress: CodeIndexLoadProgress) => void
): Promise<ArrayBuffer | null> {
  if (typeof caches === 'undefined') {
    return null;
  }

  try {
    const cache = await caches.open(CODE_INDEX_BROWSER_CACHE_NAME);
    const cached = await cache.match(getCodeIndexCacheKey(owner, repo, branch));
    if (!cached || !cached.ok) {
      debugLog('[explorar:code-index-cache] miss', {
        owner,
        repo,
        branch,
        filePath: CODE_INDEX_FILE_NAME,
        cacheKey: getCodeIndexCacheKey(owner, repo, branch),
      });
      return null;
    }
    const bytes = await cached.arrayBuffer();
    const fileCacheKey = getCodeIndexCacheKey(owner, repo, branch);
    const loadKey = getCodeIndexLoadKey(owner, repo, branch);
    codeIndexLoadSourceCache.set(loadKey, 'cache');
    codeIndexSizeCache.set(loadKey, bytes.byteLength);
    debugLog('[explorar:code-index-cache] hit', {
      owner,
      repo,
      branch,
      filePath: CODE_INDEX_FILE_NAME,
      cacheKey: fileCacheKey,
      byteLength: bytes.byteLength,
    });
    onProgress?.({
      loadedBytes: bytes.byteLength,
      totalBytes: bytes.byteLength,
      source: 'cache',
    });
    return bytes;
  } catch (error) {
    debugLog('[explorar:code-index-cache] read-error', {
      owner,
      repo,
      branch,
      filePath: CODE_INDEX_FILE_NAME,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function writeCachedCodeIndexBytes(
  owner: string,
  repo: string,
  branch: string,
  bytes: ArrayBuffer
): Promise<void> {
  if (typeof caches === 'undefined') {
    return;
  }

  try {
    const cache = await caches.open(CODE_INDEX_BROWSER_CACHE_NAME);
    const response = new Response(bytes, {
      headers: {
        'content-type': 'application/octet-stream',
      },
    });
    await cache.put(getCodeIndexCacheKey(owner, repo, branch), response);
  } catch (error) {
    debugLog('[explorar:code-index-cache] write-error', {
      owner,
      repo,
      branch,
      filePath: CODE_INDEX_FILE_NAME,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = STATIC_FETCH_TIMEOUT_MS,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function resolveRemoteContentLength(
  url: string,
  timeoutMs: number = STATIC_FETCH_TIMEOUT_MS
): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs, { method: 'HEAD' });
    if (!response.ok) {
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      return null;
    }

    const parsed = Number(contentLength);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function readBinaryFromStatic(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  timeoutMs: number = STATIC_FETCH_TIMEOUT_MS,
  onProgress?: (progress: CodeIndexLoadProgress) => void
): Promise<ArrayBuffer | null> {
  if (filePath.endsWith('/')) {
    return null;
  }

  if (filePath === CODE_INDEX_FILE_NAME) {
    const cacheKey = getCodeIndexCacheKey(owner, repo, branch);
    const cachedBytes = await readCachedCodeIndexBytes(owner, repo, branch, onProgress);
    if (cachedBytes) {
      debugLog('[explorar:binary-fetch-static] cache-hit', {
        owner,
        repo,
        branch,
        filePath,
        cacheKey,
      });
      codeIndexLoadSourceCache.set(getCodeIndexLoadKey(owner, repo, branch), 'cache');
      return cachedBytes;
    }
  }

  const url = getStaticFilePath(owner, repo, branch, filePath);

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    if (!response.ok) {
      debugLog('[explorar:binary-fetch-static] response-error', {
        owner,
        repo,
        branch,
        filePath,
        url,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const totalBytesHeader = response.headers.get('content-length');
    let totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
    if (!Number.isFinite(totalBytes ?? NaN) || (totalBytes ?? 0) <= 0) {
      const loadKey = getCodeIndexLoadKey(owner, repo, branch);
      totalBytes =
        codeIndexSizeCache.get(loadKey) ?? (await resolveRemoteContentLength(url, timeoutMs));
      if (Number.isFinite(totalBytes ?? NaN) && (totalBytes ?? 0) > 0) {
        codeIndexSizeCache.set(loadKey, totalBytes as number);
      }
    }

    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;

      onProgress?.({
        loadedBytes: 0,
        totalBytes: Number.isFinite(totalBytes ?? NaN) && (totalBytes ?? 0) > 0 ? totalBytes : null,
        source: 'network',
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        loadedBytes += value.byteLength;
        onProgress?.({
          loadedBytes,
          totalBytes:
            Number.isFinite(totalBytes ?? NaN) && (totalBytes ?? 0) > 0 ? totalBytes : null,
          source: 'network',
        });
      }

      const byteView = concatUint8Arrays(chunks);
      const bytes = byteView.buffer.slice(
        byteView.byteOffset,
        byteView.byteOffset + byteView.byteLength
      ) as ArrayBuffer;
      if (filePath === CODE_INDEX_FILE_NAME) {
        const loadKey = getCodeIndexLoadKey(owner, repo, branch);
        codeIndexSizeCache.set(loadKey, bytes.byteLength);
        codeIndexLoadSourceCache.set(loadKey, 'network');
      }
      onProgress?.({
        loadedBytes: bytes.byteLength,
        totalBytes:
          Number.isFinite(totalBytes ?? NaN) && (totalBytes ?? 0) > 0
            ? totalBytes
            : bytes.byteLength,
        source: 'network',
      });

      if (filePath === CODE_INDEX_FILE_NAME) {
        void writeCachedCodeIndexBytes(owner, repo, branch, bytes);
      }
      return bytes;
    }

    const bytes = await response.arrayBuffer();
    if (filePath === CODE_INDEX_FILE_NAME) {
      const loadKey = getCodeIndexLoadKey(owner, repo, branch);
      codeIndexSizeCache.set(loadKey, bytes.byteLength);
      codeIndexLoadSourceCache.set(loadKey, 'network');
    }
    onProgress?.({
      loadedBytes: bytes.byteLength,
      totalBytes:
        Number.isFinite(totalBytes ?? NaN) && (totalBytes ?? 0) > 0 ? totalBytes : bytes.byteLength,
      source: 'network',
    });
    if (filePath === CODE_INDEX_FILE_NAME) {
      void writeCachedCodeIndexBytes(owner, repo, branch, bytes);
    }
    return bytes;
  } catch (error) {
    debugLog('[explorar:binary-fetch-static] error', {
      owner,
      repo,
      branch,
      filePath,
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if a repository is curated (pre-downloaded at build time)
 */
export function isCuratedRepo(owner: string, repo: string): boolean {
  return isConfiguredCuratedRepo(owner, repo);
}

export function resolveCorpusPathFromKnownFiles(
  filePath: string,
  knownPaths: Iterable<string>
): string | null {
  const normalizedPath = filePath.replace(/\/+$/, '');
  if (!normalizedPath) {
    return null;
  }

  const paths = Array.from(knownPaths);
  if (paths.includes(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.includes('/')) {
    const basename = normalizedPath.split('/').pop();
    if (!basename) return null;
    const matches = paths.filter((candidate) => candidate.endsWith(`/${basename}`));
    if (matches.length === 1) {
      return matches[0];
    }

    const arm64Matches = matches.filter((candidate) => /(^|\/)arm64(\/|$)/.test(candidate));
    return arm64Matches.length === 1 ? arm64Matches[0] : null;
  }

  const matches = paths.filter((candidate) => candidate.split('/').pop() === normalizedPath);
  if (matches.length === 1) {
    return matches[0];
  }

  const arm64Matches = matches.filter((candidate) => /(^|\/)arm64(\/|$)/.test(candidate));
  return arm64Matches.length === 1 ? arm64Matches[0] : null;
}

function collectFilePaths(tree: FileNode[] | null): string[] {
  if (!tree) {
    return [];
  }

  const paths: string[] = [];
  const walk = (nodes: FileNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'file') {
        paths.push(node.path);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(tree);
  return paths;
}

export async function resolveCorpusPathFromTree(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const normalizedPath = filePath.replace(/\/+$/, '');
  if (!normalizedPath) {
    return null;
  }

  const tree = await getTreeStructureFromStatic(owner, repo, branch);
  const knownPaths = collectFilePaths(tree);
  return resolveCorpusPathFromKnownFiles(normalizedPath, knownPaths);
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
): Array<{ url: string; resolvedSource: 'r2-bucket' | 'static-path' }> {
  const candidates: Array<{ url: string; resolvedSource: 'r2-bucket' | 'static-path' }> = [
    {
      url: getStaticFilePath(owner, repo, branch, filePath),
      resolvedSource: 'r2-bucket',
    },
    {
      url: buildCuratedRepoStaticPath(owner, repo, branch, filePath),
      resolvedSource: 'static-path',
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
  if (filePath.endsWith('/')) {
    throw new Error(`File not found: ${filePath}`);
  }

  const candidates = getStaticFileCandidates(owner, repo, branch, filePath);

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      debugLog('[explorar:file-fetch-static] start', {
        owner,
        repo,
        branch,
        filePath,
        source: candidate.resolvedSource,
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
          source: candidate.resolvedSource,
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
        source: candidate.resolvedSource,
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

  const cacheKey = `${owner}/${repo}@${branch}`;
  const cached = treeStructureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const treePromise = (async () => {
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
              source: candidate.resolvedSource,
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
            source: candidate.resolvedSource,
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
            source: candidate.resolvedSource,
            resolvedSource: candidate.resolvedSource,
            url: candidate.url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Return null silently - missing manifests are expected for branches that weren't downloaded
    return null;
  })();

  treeStructureCache.set(cacheKey, treePromise);

  try {
    const tree = await treePromise;
    if (!tree) {
      treeStructureCache.delete(cacheKey);
    }
    return tree;
  } catch (error) {
    treeStructureCache.delete(cacheKey);
    throw error;
  }
}

export async function getCodeIndexFromStatic(
  owner: string,
  repo: string,
  branch: string,
  options?: {
    onProgress?: (progress: CodeIndexLoadProgress) => void;
  }
): Promise<LoadedCodeIndex | null> {
  if (!isCuratedRepo(owner, repo)) {
    return null;
  }

  const cacheKey = `${owner}/${repo}@${branch}`;
  if (!codeIndexCache.has(cacheKey)) {
    debugLog('[explorar:code-index-static] load-start', {
      owner,
      repo,
      branch,
      cacheKey,
      cacheState: 'miss',
    });
    codeIndexCache.set(
      cacheKey,
      (async () => {
        const bytes = await readBinaryFromStatic(
          owner,
          repo,
          branch,
          CODE_INDEX_FILE_NAME,
          SEARCH_INDEX_FETCH_TIMEOUT_MS,
          options?.onProgress
        );

        if (!bytes) {
          return null;
        }

        const sqlJs = await import('sql.js');
        const initSqlJs = sqlJs.default;
        const SQL = await initSqlJs({
          locateFile: (file: string) => `/sqljs/${file}`,
        });

        const db = new SQL.Database(new Uint8Array(bytes)) as unknown as CodeIndexDatabaseLike;
        const metadataStatement = db.prepare(
          'SELECT Version AS version, BuildSignature AS buildSignature, CreatedAt AS createdAt, Owner AS owner, Repo AS repo, Branch AS branch, FileCount AS fileCount FROM Metadata LIMIT 1'
        );

        try {
          if (!metadataStatement.step()) {
            return null;
          }

          const metadata = metadataStatement.getAsObject() as Partial<CodeIndexMetadata>;
          if (metadata.version !== CODE_INDEX_VERSION) {
            return null;
          }

          const handle: LoadedCodeIndex = {
            db,
            fileCount: Number(metadata.fileCount ?? 0),
            buildSignature: String(metadata.buildSignature ?? ''),
          };

          debugLog('[explorar:code-index-static] success', {
            owner,
            repo,
            branch,
            filePath: CODE_INDEX_FILE_NAME,
            url: getStaticFilePath(owner, repo, branch, CODE_INDEX_FILE_NAME),
            fileCount: handle.fileCount,
          });

          return handle;
        } finally {
          metadataStatement.free();
        }
      })()
    );
  } else {
    debugLog('[explorar:code-index-static] load-start', {
      owner,
      repo,
      branch,
      cacheKey,
      cacheState: 'hit',
    });
  }

  const payload = await codeIndexCache.get(cacheKey)!;

  if (!payload) {
    debugLog('[explorar:code-index-static] load-empty', {
      owner,
      repo,
      branch,
      cacheKey,
    });
    return null;
  }

  const loadSource = codeIndexLoadSourceCache.get(cacheKey);
  if (loadSource) {
    const totalBytes = codeIndexSizeCache.get(cacheKey) ?? 0;
    debugLog('[explorar:code-index-static] load-progress-emitted', {
      owner,
      repo,
      branch,
      cacheKey,
      source: loadSource,
      totalBytes,
    });
    options?.onProgress?.({
      loadedBytes: totalBytes,
      totalBytes,
      source: loadSource,
    });
    debugLog('[explorar:code-index-static] load-yield-before-parse', {
      owner,
      repo,
      branch,
      cacheKey,
      source: loadSource,
    });
    await yieldToPaint();
  } else {
    debugLog('[explorar:code-index-static] load-progress-missing', {
      owner,
      repo,
      branch,
      cacheKey,
    });
  }

  debugLog('[explorar:code-index-static] load-success', {
    owner,
    repo,
    branch,
    cacheKey,
    fileCount: payload.fileCount,
    buildSignature: payload.buildSignature,
  });

  return payload;
}
