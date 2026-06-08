const FILE_SOURCE_MODE_KEY = 'explorar-file-source-mode';
const FILE_SOURCE_MODE_CHANGE_EVENT = 'explorar:file-source-mode-change';

export type FileSourceMode = 'local-filesystem' | 'github-api' | 'r2-bucket';
export type StaticFileSourceMode = Exclude<FileSourceMode, 'github-api'>;
export class InvalidR2PublicBaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidR2PublicBaseUrlError';
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  const withoutWrappingQuotes = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
  const extractedUrl = withoutWrappingQuotes.match(/https?:\/\/[^\s'"]+/i)?.[0];
  const normalized = extractedUrl ?? withoutWrappingQuotes;
  return normalized.replace(/\/+$/, '');
}

function buildRepoPath(owner: string, repo: string, branch: string, filePath: string): string {
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  return `/repos/${owner}/${repo}/${branch}/${cleanPath}`;
}

function getConfiguredR2BaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_CURATED_CONTENT_BASE_URL?.trim();
  return baseUrl ? normalizeBaseUrl(baseUrl) : '';
}

function getConfiguredPublicR2BaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();
  return baseUrl ? normalizeBaseUrl(baseUrl) : '';
}

export function getR2BucketBaseUrl(): string {
  const configuredBaseUrl = getConfiguredPublicR2BaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const legacyConfiguredBaseUrl = getConfiguredR2BaseUrl();
  if (legacyConfiguredBaseUrl) {
    return legacyConfiguredBaseUrl;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return siteUrl ? normalizeBaseUrl(siteUrl) : 'https://explorar.dev';
}

export function validateR2PublicBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new InvalidR2PublicBaseUrlError(`Invalid NEXT_PUBLIC_R2_PUBLIC_BASE_URL: "${baseUrl}".`);
  }

  if (url.host.endsWith('.r2.cloudflarestorage.com')) {
    throw new InvalidR2PublicBaseUrlError(
      `NEXT_PUBLIC_R2_PUBLIC_BASE_URL points to the Cloudflare R2 S3 API endpoint (${url.origin}), which is not a public browser origin. Use a public *.r2.dev URL or a custom domain instead.`
    );
  }
}

export function getValidatedR2BucketBaseUrl(): string {
  const baseUrl = getR2BucketBaseUrl();
  validateR2PublicBaseUrl(baseUrl);
  return baseUrl;
}

export function hasConfiguredPublicR2BaseUrl(): boolean {
  return Boolean(getConfiguredPublicR2BaseUrl());
}

export function getCuratedContentBaseUrl(): string {
  const configuredBaseUrl = getConfiguredR2BaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return siteUrl ? normalizeBaseUrl(siteUrl) : 'https://explorar.dev';
}

export function getDefaultFileSourceMode(): FileSourceMode {
  return process.env.NODE_ENV === 'production' ? 'r2-bucket' : 'local-filesystem';
}

export function getFileSourceMode(): FileSourceMode {
  if (typeof window === 'undefined') {
    return getDefaultFileSourceMode();
  }

  const storedMode = window.localStorage.getItem(FILE_SOURCE_MODE_KEY);
  if (
    storedMode === 'local-filesystem' ||
    storedMode === 'github-api' ||
    storedMode === 'r2-bucket'
  ) {
    return storedMode;
  }

  return getDefaultFileSourceMode();
}

export function setFileSourceMode(mode: FileSourceMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(FILE_SOURCE_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(FILE_SOURCE_MODE_CHANGE_EVENT, { detail: mode }));
}

export function subscribeToFileSourceMode(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === FILE_SOURCE_MODE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(FILE_SOURCE_MODE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(FILE_SOURCE_MODE_CHANGE_EVENT, onStoreChange);
  };
}

export function getFileSourceModeServerSnapshot(): FileSourceMode {
  return getDefaultFileSourceMode();
}

export function getFileSourceModeLabel(mode: FileSourceMode): string {
  switch (mode) {
    case 'local-filesystem':
      return 'Local filesystem';
    case 'github-api':
      return 'api.github.com';
    case 'r2-bucket':
      return 'R2 bucket';
  }
}

export function isStaticFileSourceMode(mode: FileSourceMode): mode is StaticFileSourceMode {
  return mode !== 'github-api';
}

export function buildLocalRepoUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  return buildRepoPath(owner, repo, branch, filePath);
}

export function buildR2RepoUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  return `${getValidatedR2BucketBaseUrl()}${buildRepoPath(owner, repo, branch, filePath)}`;
}

export function buildCuratedRepoUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  source: StaticFileSourceMode = 'local-filesystem'
): string {
  if (source === 'r2-bucket') {
    return buildR2RepoUrl(owner, repo, branch, filePath);
  }

  return buildLocalRepoUrl(owner, repo, branch, filePath);
}
