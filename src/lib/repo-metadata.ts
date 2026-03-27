// Repository metadata fetching and caching utility
// Fetches repo owner avatar URLs from GitHub API and caches them in localStorage

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

/**
 * Get the localStorage key for a repository
 */
function getCacheKey(owner: string, repo: string): string {
  return `${CACHE_KEY_PREFIX}${owner}/${repo}`;
}

/**
 * Check if cached metadata is still valid
 */
function isCacheValid(metadata: RepoMetadata): boolean {
  const age = Date.now() - metadata.fetchedAt;
  return age < CACHE_TTL;
}

/**
 * Get cached metadata from localStorage
 */
function getCachedMetadata(owner: string, repo: string): RepoMetadata | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = getCacheKey(owner, repo);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return null;

    const metadata: RepoMetadata = JSON.parse(cached);

    // Check if cache is still valid
    if (isCacheValid(metadata)) {
      return metadata;
    }

    // Cache expired, remove it
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.error('[RepoMetadata] Error reading from localStorage:', error);
    return null;
  }
}

/**
 * Store metadata in localStorage
 */
function setCachedMetadata(metadata: RepoMetadata): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(metadata.owner, metadata.repo);
    localStorage.setItem(cacheKey, JSON.stringify(metadata));
  } catch (error) {
    console.error('[RepoMetadata] Error writing to localStorage:', error);
    // Silently fail - don't break the app if localStorage is full
  }
}

/**
 * Fetch repository metadata from GitHub API
 * Extracts owner avatar URL for display
 */
async function fetchFromGitHub(owner: string, repo: string): Promise<RepoMetadata> {
  console.log('[RepoMetadata] Fetching from GitHub API:', { owner, repo });

  const url = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Explorar.dev',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract owner info - owner field contains user or org data
    const ownerData = data.owner;
    if (!ownerData || !ownerData.avatar_url) {
      throw new Error('No owner or avatar URL in GitHub response');
    }

    const metadata: RepoMetadata = {
      owner,
      repo,
      ownerAvatarUrl: ownerData.avatar_url,
      ownerType: ownerData.type as 'User' | 'Organization',
      description: data.description || undefined,
      fetchedAt: Date.now(),
    };

    console.log('[RepoMetadata] Successfully fetched metadata:', {
      owner,
      repo,
      ownerType: metadata.ownerType,
    });

    return metadata;
  } catch (error) {
    console.error('[RepoMetadata] Failed to fetch from GitHub:', {
      owner,
      repo,
      error,
    });
    throw error;
  }
}

/**
 * Get repository metadata with caching
 * First checks localStorage, then fetches from GitHub API if needed
 */
export async function getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata | null> {
  try {
    // Try to get from cache first
    const cached = getCachedMetadata(owner, repo);
    if (cached) {
      console.log('[RepoMetadata] Using cached metadata:', { owner, repo });
      return cached;
    }

    // Fetch from GitHub
    const metadata = await fetchFromGitHub(owner, repo);

    // Cache the result
    setCachedMetadata(metadata);

    return metadata;
  } catch (error) {
    console.error('[RepoMetadata] Error getting repo metadata:', {
      owner,
      repo,
      error,
    });
    return null;
  }
}

/**
 * Batch fetch metadata for multiple repositories
 * Useful for loading multiple repos at once
 */
export async function getMultipleRepoMetadata(
  repos: Array<{ owner: string; repo: string }>
): Promise<Map<string, RepoMetadata | null>> {
  const results = new Map<string, RepoMetadata | null>();

  // Fetch in parallel but with reasonable limits to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < repos.length; i += batchSize) {
    const batch = repos.slice(i, i + batchSize);
    const promises = batch.map(({ owner, repo }) =>
      getRepoMetadata(owner, repo).then((metadata) => ({
        key: `${owner}/${repo}`,
        metadata,
      }))
    );

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ key, metadata }) => {
      results.set(key, metadata);
    });
  }

  return results;
}
