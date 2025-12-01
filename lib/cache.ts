
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = "concept_cache_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedConcept<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    
    const item = JSON.parse(raw) as CacheItem<T>;
    if (Date.now() - item.timestamp > CACHE_TTL) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return item.data;
  } catch {
    return null;
  }
}

export function setCachedConcept<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    console.warn("Failed to cache concept:", e);
  }
}
