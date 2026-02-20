/**
 * Simple in-memory cache for development performance
 * - Reduces repeated DB queries during dev hot reloading
 * - Not for production (use Redis)
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class DevCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5000; // 5 seconds for dev

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate keys matching a pattern (e.g. "articles:user1:*")
   * Simple implementation: converts * to .* for regex matching
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  // Create a cached function wrapper
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyPrefix: string,
    ttlMs?: number
  ): T {
    return (async (...args: any[]) => {
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      const cached = this.get<ReturnType<T>>(key);
      if (cached) return cached;

      const result = await fn(...args);
      this.set(key, result, ttlMs);
      return result;
    }) as T;
  }
}

export const devCache = new DevCache();

// Cache key helpers
export const cacheKeys = {
  articles: (userId: string, page: number, pageSize: number) =>
    `articles:${userId}:${page}:${pageSize}`,
  stats: (userId: string, period: string) => `stats:${userId}:${period}`,
  concepts: (userId: string) => `concepts:${userId}`,
};

// Cache Manager
export class CacheManager {
  /**
   * Invalidate all caches for a user
   */
  static invalidateUserCaches(userId: string) {
    const patterns = [
      `articles:${userId}:*`,
      `concepts:${userId}:*`,
      `collections:${userId}:*`,
      `stats:${userId}:*`,
    ];

    patterns.forEach(pattern => {
      devCache.invalidatePattern(pattern);
    });
  }

  /**
   * Invalidate specific resource cache
   */
  static invalidateResource(userId: string, resource: 'articles' | 'concepts' | 'collections' | 'stats') {
    devCache.invalidatePattern(`${resource}:${userId}:*`);
  }
}

