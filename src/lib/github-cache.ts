// GitHub API caching utilities with enhanced persistence and fault tolerance
// Uses IndexedDB as primary storage with localStorage fallback

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number; // For cache versioning/invalidation
  size?: number; // Size in bytes for cache management
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  totalSize: number;
  entryCount: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache size
const DB_NAME = 'github-cache';
const DB_VERSION = 2; // Incremented for schema changes
const STORE_NAME = 'api-cache';
const STATS_STORE_NAME = 'cache-stats';
const FALLBACK_PREFIX = 'github_cache_';

let dbPromise: Promise<IDBDatabase> | null = null;
let cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  totalSize: 0,
  entryCount: 0,
};

// Debug mode - can be enabled via localStorage or environment
const DEBUG_MODE =
  typeof window !== 'undefined' &&
  (localStorage.getItem('github_cache_debug') === 'true' || process.env.NODE_ENV === 'development');

function debugLog(...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.log('[GitHub Cache]', ...args);
  }
}

function debugError(...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.error('[GitHub Cache Error]', ...args);
  }
}

/**
 * Get or create IndexedDB database with improved error handling
 */
function getDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      debugError('IndexedDB not available');
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = request.error;
      debugError('IndexedDB open error:', error);
      cacheStats.errors++;
      reject(error);
    };

    request.onsuccess = () => {
      debugLog('IndexedDB opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create cache store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME);
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        debugLog('Created cache store');
      }

      // Create stats store if it doesn't exist
      if (!db.objectStoreNames.contains(STATS_STORE_NAME)) {
        db.createObjectStore(STATS_STORE_NAME);
        debugLog('Created stats store');
      }

      // Handle version upgrades
      if (event.oldVersion < 2) {
        // Migrate from version 1 to 2
        debugLog('Migrating cache from version 1 to 2');
      }
    };

    request.onblocked = () => {
      debugError('IndexedDB upgrade blocked - close other tabs');
    };
  });

  return dbPromise;
}

/**
 * Fallback to localStorage for small data
 */
function getLocalStorageCache<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const item = localStorage.getItem(FALLBACK_PREFIX + key);
    if (!item) {
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(item);

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(FALLBACK_PREFIX + key);
      return null;
    }

    debugLog('Cache hit (localStorage):', key);
    cacheStats.hits++;
    return entry.data;
  } catch (error) {
    debugError('localStorage read error:', error);
    cacheStats.errors++;
    return null;
  }
}

function setLocalStorageCache<T>(key: string, data: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    // Only use localStorage for small entries (< 1MB)
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
      version: 1,
    };

    const serialized = JSON.stringify(entry);
    const size = new Blob([serialized]).size;

    // localStorage has ~5-10MB limit, be conservative
    if (size > 1024 * 1024) {
      debugLog('Entry too large for localStorage, skipping:', key, size);
      return;
    }

    localStorage.setItem(FALLBACK_PREFIX + key, serialized);
    debugLog('Cache set (localStorage):', key);
  } catch (error) {
    // Handle quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      debugError('localStorage quota exceeded, clearing old entries');
      clearOldLocalStorageEntries();
    } else {
      debugError('localStorage write error:', error);
    }
    cacheStats.errors++;
  }
}

function clearOldLocalStorageEntries(): void {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter((k) => k.startsWith(FALLBACK_PREFIX));

    // Sort by timestamp and remove oldest 50%
    const entries = cacheKeys
      .map((key) => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            return { key, timestamp: entry.timestamp };
          }
        } catch {
          return null;
        }
        return null;
      })
      .filter(Boolean) as Array<{ key: string; timestamp: number }>;

    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));

    toRemove.forEach(({ key }) => {
      localStorage.removeItem(key);
    });

    debugLog('Cleared', toRemove.length, 'old localStorage entries');
  } catch (error) {
    debugError('Error clearing localStorage:', error);
  }
}

/**
 * Get cache entry with fallback
 */
async function getCache<T>(key: string): Promise<T | null> {
  // Try IndexedDB first
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        debugError('IndexedDB get error:', request.error);
        cacheStats.errors++;
        // Fallback to localStorage
        resolve(getLocalStorageCache<T>(key));
      };

      request.onsuccess = () => {
        const entry: CacheEntry<T> | undefined = request.result;
        if (!entry) {
          cacheStats.misses++;
          // Try localStorage fallback
          resolve(getLocalStorageCache<T>(key));
          return;
        }

        // Check if cache entry is expired
        if (Date.now() > entry.expiresAt) {
          debugLog('Cache expired:', key);
          // Delete expired entry
          deleteCache(key).catch(console.error);
          cacheStats.misses++;
          resolve(null);
          return;
        }

        debugLog('Cache hit (IndexedDB):', key);
        cacheStats.hits++;
        resolve(entry.data);
      };
    });
  } catch (error) {
    debugError('IndexedDB get failed, using localStorage fallback:', error);
    cacheStats.errors++;
    return getLocalStorageCache<T>(key);
  }
}

/**
 * Set cache entry with size management
 */
async function setCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_DURATION,
    version: 1,
  };

  // Try to estimate size
  try {
    const serialized = JSON.stringify(entry);
    entry.size = new Blob([serialized]).size;
  } catch {
    // Size estimation failed, continue anyway
  }

  // Try IndexedDB first
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put(entry, key);

      request.onerror = () => {
        debugError('IndexedDB put error:', request.error);
        cacheStats.errors++;
        // Fallback to localStorage
        setLocalStorageCache(key, data);
        resolve();
      };

      request.onsuccess = () => {
        debugLog('Cache set (IndexedDB):', key);
        cacheStats.entryCount++;
        if (entry.size) {
          cacheStats.totalSize += entry.size;
        }

        // Check if we need to clean up old entries
        if (cacheStats.totalSize > MAX_CACHE_SIZE) {
          cleanupOldEntries().catch(console.error);
        }

        resolve();
      };
    });
  } catch (error) {
    debugError('IndexedDB set failed, using localStorage fallback:', error);
    cacheStats.errors++;
    setLocalStorageCache(key, data);
  }
}

/**
 * Clean up old entries when cache size exceeds limit
 */
async function cleanupOldEntries(): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    const request = index.openCursor();
    const entries: Array<{ key: string; timestamp: number; size: number }> = [];

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const entry = cursor.value as CacheEntry<unknown>;
          entries.push({
            key: entry.key,
            timestamp: entry.timestamp,
            size: entry.size || 0,
          });
          cursor.continue();
        } else {
          // Sort by timestamp (oldest first)
          entries.sort((a, b) => a.timestamp - b.timestamp);

          // Remove oldest entries until we're under 80% of max size
          let removedSize = 0;
          const targetSize = MAX_CACHE_SIZE * 0.8;

          for (const entry of entries) {
            if (cacheStats.totalSize - removedSize <= targetSize) {
              break;
            }

            store.delete(entry.key);
            removedSize += entry.size;
            cacheStats.entryCount--;
          }

          cacheStats.totalSize -= removedSize;
          debugLog('Cleaned up', removedSize, 'bytes from cache');
          resolve();
        }
      };

      request.onerror = () => {
        debugError('Cleanup error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    debugError('Cleanup failed:', error);
  }
}

async function deleteCache(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => {
        debugError('IndexedDB delete error:', request.error);
        // Also try localStorage
        try {
          localStorage.removeItem(FALLBACK_PREFIX + key);
        } catch {
          // Ignore
        }
        resolve();
      };

      request.onsuccess = () => {
        // Also remove from localStorage if present
        try {
          localStorage.removeItem(FALLBACK_PREFIX + key);
        } catch {
          // Ignore
        }
        debugLog('Cache deleted:', key);
        resolve();
      };
    });
  } catch (error) {
    debugError('IndexedDB delete failed:', error);
    // Try localStorage
    try {
      localStorage.removeItem(FALLBACK_PREFIX + key);
    } catch {
      // Ignore
    }
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        debugError('IndexedDB clear error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        // Also clear localStorage
        try {
          const keys = Object.keys(localStorage);
          keys
            .filter((k) => k.startsWith(FALLBACK_PREFIX))
            .forEach((key) => {
              localStorage.removeItem(key);
            });
        } catch {
          // Ignore
        }

        cacheStats = {
          hits: 0,
          misses: 0,
          errors: 0,
          totalSize: 0,
          entryCount: 0,
        };

        debugLog('Cache cleared');
        resolve();
      };
    });
  } catch (error) {
    debugError('Clear cache failed:', error);
    // Try localStorage
    try {
      const keys = Object.keys(localStorage);
      keys
        .filter((k) => k.startsWith(FALLBACK_PREFIX))
        .forEach((key) => {
          localStorage.removeItem(key);
        });
    } catch {
      // Ignore
    }
  }
}

export function getCacheKey(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  type: 'file' | 'directory' | 'tags' | 'default-branch' | 'branches' | string
): string {
  return `${owner}/${repo}/${branch}/${type}/${path}`;
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  return getCache<T>(key);
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  return setCache<T>(key, data);
}
