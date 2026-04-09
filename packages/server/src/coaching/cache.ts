interface CacheEntry {
  response: string;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (meta changes per patch, ~2 weeks)

export function getCacheKey(
  playerChampion: string,
  enemyChampion: string,
  role: string,
  patch: string
): string {
  return `${patch}:${playerChampion}:${role}:${enemyChampion}`;
}

export function getCachedResponse(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.response;
}

export function setCachedResponse(key: string, response: string): void {
  cache.set(key, { response, createdAt: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}
