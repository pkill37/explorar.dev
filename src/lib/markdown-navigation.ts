export interface RepoNavigationTarget {
  path: string;
  searchPattern?: string;
  scrollToLine?: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hasUnsafeScheme(href: string): boolean {
  return /^(javascript|data|vbscript):/i.test(href.trim());
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href.trim());
}

export function resolveRepoRelativePath(currentFilePath: string, href: string): string | null {
  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref.startsWith('#') || isExternalHref(trimmedHref)) {
    return null;
  }

  const withoutHash = trimmedHref.split('#')[0] || '';
  if (!withoutHash) {
    return null;
  }

  const currentDirParts = currentFilePath.split('/').slice(0, -1);
  const targetParts = withoutHash.split('/');
  const resolvedParts = trimmedHref.startsWith('/') ? [] : [...currentDirParts];

  for (const part of targetParts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (resolvedParts.length > 0) {
        resolvedParts.pop();
      }
      continue;
    }
    resolvedParts.push(part);
  }

  return resolvedParts.join('/');
}

function normalizeSearchPattern(pattern: string): string {
  return pattern.replace(/\(\)$/, '');
}

function looksLikeRepoPath(path: string): boolean {
  if (!path || /\s/.test(path) || isExternalHref(path)) {
    return false;
  }

  const normalized = path.replace(/^\/+/, '');
  if (/^[A-Za-z0-9._+-]+\/$/.test(normalized)) {
    return true;
  }

  if (/^[A-Za-z0-9._+-]+\.[A-Za-z0-9._+-]+$/.test(normalized)) {
    return true;
  }

  if (!normalized.includes('/')) {
    return false;
  }

  return normalized
    .split('/')
    .filter(Boolean)
    .every((segment) => /^[A-Za-z0-9._+-]+$/.test(segment));
}

export function parseRepoNavigationTarget(
  rawValue: string,
  currentFilePath?: string
): RepoNavigationTarget | null {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.length > 200) {
    return null;
  }

  const withoutHash = trimmed.split('#')[0] || trimmed;
  const lastColon = withoutHash.lastIndexOf(':');
  const lastSlash = withoutHash.lastIndexOf('/');

  let pathPart = withoutHash;
  let suffix = '';

  if (lastColon > lastSlash) {
    pathPart = withoutHash.slice(0, lastColon);
    suffix = withoutHash.slice(lastColon + 1);
  }

  const resolvedPath = currentFilePath
    ? (resolveRepoRelativePath(currentFilePath, pathPart) ?? pathPart.replace(/^\/+/, ''))
    : pathPart.replace(/^\/+/, '');

  if (!looksLikeRepoPath(resolvedPath)) {
    return null;
  }

  const target: RepoNavigationTarget = { path: resolvedPath };

  if (!suffix) {
    return target;
  }

  if (/^L?\d+$/.test(suffix)) {
    target.scrollToLine = parseInt(suffix.replace(/^L/i, ''), 10);
    return target;
  }

  const normalizedPattern = normalizeSearchPattern(suffix);
  if (/^[A-Za-z_][A-Za-z0-9_:.<>\-~]*$/.test(normalizedPattern)) {
    target.searchPattern = normalizedPattern;
    return target;
  }

  return { path: resolvedPath };
}

export function getRepoLinkAttributes(target: RepoNavigationTarget): string {
  const attributes = [`data-repo-path="${escapeHtml(target.path)}"`];

  if (target.searchPattern) {
    attributes.push(`data-search-pattern="${escapeHtml(target.searchPattern)}"`);
  }

  if (typeof target.scrollToLine === 'number') {
    attributes.push(`data-scroll-to-line="${target.scrollToLine}"`);
  }

  return attributes.join(' ');
}
