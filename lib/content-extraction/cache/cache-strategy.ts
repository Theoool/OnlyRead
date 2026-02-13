/**
 * 缓存策略 - 支持内存和持久化缓存
 * 优化：使用 LRU 算法，支持 TTL
 */

import type { ICacheStrategy, ExtractedContent } from '../core/types';

// ============================================================================
// 内存缓存（LRU）
// ============================================================================

interface CacheEntry {
  value: ExtractedContent;
  timestamp: number;
  ttl: number;
  accessCount: number;
}

export class MemoryCacheStrategy implements ICacheStrategy {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(maxSize = 100, defaultTtl = 3600000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  async get(key: string): Promise<ExtractedContent | null> {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问计数
    entry.accessCount++;
    return entry.value;
  }

  async set(key: string, value: ExtractedContent, ttl?: number): Promise<void> {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
      accessCount: 0,
    });
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * LRU 淘汰策略
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let minAccessCount = Infinity;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // 优先淘汰访问次数少的
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        oldestTimestamp = entry.timestamp;
        lruKey = key;
      } else if (entry.accessCount === minAccessCount && entry.timestamp < oldestTimestamp) {
        // 访问次数相同，淘汰最旧的
        oldestTimestamp = entry.timestamp;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; accessCount: number; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: Date.now() - entry.timestamp,
    }));

    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const hitRate = totalAccess > 0 ? (totalAccess / this.cache.size) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount),
    };
  }
}

// ============================================================================
// IndexedDB 缓存（浏览器端持久化）
// ============================================================================

export class IndexedDBCacheStrategy implements ICacheStrategy {
  private dbName = 'content-extraction-cache';
  private storeName = 'extractions';
  private db: IDBDatabase | null = null;
  private defaultTtl: number;

  constructor(defaultTtl = 3600000) {
    this.defaultTtl = defaultTtl;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async get(key: string): Promise<ExtractedContent | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.delete(key);
          resolve(null);
          return;
        }

        resolve(entry.value);
      };
    });
  }

  async set(key: string, value: ExtractedContent, ttl?: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({
        key,
        value,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTtl,
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async size(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// ============================================================================
// 多层缓存策略
// ============================================================================

export class TieredCacheStrategy implements ICacheStrategy {
  private l1Cache: MemoryCacheStrategy;
  private l2Cache: IndexedDBCacheStrategy | null;

  constructor(
    memorySize = 50,
    defaultTtl = 3600000,
    useIndexedDB = false
  ) {
    this.l1Cache = new MemoryCacheStrategy(memorySize, defaultTtl);
    this.l2Cache = useIndexedDB ? new IndexedDBCacheStrategy(defaultTtl) : null;
  }

  async get(key: string): Promise<ExtractedContent | null> {
    // 先查 L1 缓存
    let value = await this.l1Cache.get(key);
    if (value) return value;

    // 再查 L2 缓存
    if (this.l2Cache) {
      value = await this.l2Cache.get(key);
      if (value) {
        // 回填到 L1
        await this.l1Cache.set(key, value);
        return value;
      }
    }

    return null;
  }

  async set(key: string, value: ExtractedContent, ttl?: number): Promise<void> {
    await this.l1Cache.set(key, value, ttl);
    if (this.l2Cache) {
      await this.l2Cache.set(key, value, ttl);
    }
  }

  async has(key: string): Promise<boolean> {
    const hasL1 = await this.l1Cache.has(key);
    if (hasL1) return true;

    if (this.l2Cache) {
      return await this.l2Cache.has(key);
    }

    return false;
  }

  async delete(key: string): Promise<void> {
    await this.l1Cache.delete(key);
    if (this.l2Cache) {
      await this.l2Cache.delete(key);
    }
  }

  async clear(): Promise<void> {
    await this.l1Cache.clear();
    if (this.l2Cache) {
      await this.l2Cache.clear();
    }
  }

  async size(): Promise<number> {
    return await this.l1Cache.size();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return this.l1Cache.getStats();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCacheStrategy(
  type: 'memory' | 'indexeddb' | 'tiered' = 'memory',
  options?: {
    maxSize?: number;
    defaultTtl?: number;
    useIndexedDB?: boolean;
  }
): ICacheStrategy {
  const { maxSize = 100, defaultTtl = 3600000, useIndexedDB = false } = options || {};

  switch (type) {
    case 'memory':
      return new MemoryCacheStrategy(maxSize, defaultTtl);
    case 'indexeddb':
      return new IndexedDBCacheStrategy(defaultTtl);
    case 'tiered':
      return new TieredCacheStrategy(maxSize, defaultTtl, useIndexedDB);
    default:
      return new MemoryCacheStrategy(maxSize, defaultTtl);
  }
}

