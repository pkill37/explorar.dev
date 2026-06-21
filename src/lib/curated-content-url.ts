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

  return '';
}

export function hasConfiguredPublicR2BaseUrl(): boolean {
  return Boolean(getConfiguredPublicR2BaseUrl());
}

export function getCuratedContentBaseUrl(): string {
  return getR2BucketBaseUrl();
}

export function buildCuratedRepoUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  const baseUrl = getR2BucketBaseUrl();
  if (!baseUrl) {
    return buildRepoPath(owner, repo, branch, filePath);
  }

  return `${baseUrl}${buildRepoPath(owner, repo, branch, filePath)}`;
}
