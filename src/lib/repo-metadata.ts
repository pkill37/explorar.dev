// Repository metadata utility for homepage cards.
// We avoid runtime GitHub API calls here because the UI only needs an owner avatar.

export interface RepoMetadata {
  owner: string;
  repo: string;
  ownerAvatarUrl: string;
  ownerType: 'User' | 'Organization';
  description?: string;
  fetchedAt: number;
}

const CACHE_KEY_PREFIX = 'repo_metadata_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

function getCacheKey(owner: string, repo: string): string {
  return `${CACHE_KEY_PREFIX}${owner}/${repo}`;
}

function isCacheValid(metadata: RepoMetadata): boolean {
  const age = Date.now() - metadata.fetchedAt;
  return age < CACHE_TTL;
}

function getCachedMetadata(owner: string, repo: string): RepoMetadata | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = getCacheKey(owner, repo);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return null;

    const metadata: RepoMetadata = JSON.parse(cached);
    if (isCacheValid(metadata)) {
      return metadata;
    }

    localStorage.removeItem(cacheKey);
    return null;
  } catch {
    return null;
  }
}

function setCachedMetadata(metadata: RepoMetadata): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(metadata.owner, metadata.repo);
    localStorage.setItem(cacheKey, JSON.stringify(metadata));
  } catch {
    // Ignore localStorage failures; the UI can recompute this metadata.
  }
}

function createFallbackMetadata(owner: string, repo: string): RepoMetadata {
  return {
    owner,
    repo,
    ownerAvatarUrl: `https://github.com/${owner}.png?size=128`,
    // The homepage does not currently depend on ownerType.
    ownerType: 'Organization',
    fetchedAt: Date.now(),
  };
}

export async function getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata | null> {
  const cached = getCachedMetadata(owner, repo);
  if (cached) {
    return cached;
  }

  const metadata = createFallbackMetadata(owner, repo);
  setCachedMetadata(metadata);
  return metadata;
}

export async function getMultipleRepoMetadata(
  repos: Array<{ owner: string; repo: string }>
): Promise<Map<string, RepoMetadata | null>> {
  const results = new Map<string, RepoMetadata | null>();

  repos.forEach(({ owner, repo }) => {
    results.set(`${owner}/${repo}`, createFallbackMetadata(owner, repo));
  });

  return results;
}
