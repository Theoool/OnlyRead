/**
 * 检索缓存管理器
 */

import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 检索缓存类
 */
export class RetrievalCache {
  private static embeddingCache = new Map<string, CacheEntry<number[]>>();
  private static resultCache = new Map<string, CacheEntry<any>>();
  
  private static readonly DEFAULT_TTL = 3600000; // 1小时
  private static readonly MAX_CACHE_SIZE = 1000;

  /**
   * 生成缓存键
   */
  private static generateKey(prefix: string, ...parts: any[]): string {
    return `${prefix}:${parts.map(p => JSON.stringify(p)).join(':')}`;
  }

  /**
   * 获取或生成embedding（带缓存）
   */
  static async getOrGenerateEmbedding(query: string): Promise<number[]> {
    const key = this.generateKey('emb', query);
    const cached = this.embeddingCache.get(key);

    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('[RetrievalCache] Embedding cache hit:', query.slice(0, 50));
      return cached.data;
    }

    // 生成新的embedding
    console.log('[RetrievalCache] Embedding cache miss, generating:', query.slice(0, 50));
    const embedding = await generateEmbedding(query);

    // 存入缓存
    this.embeddingCache.set(key, {
      data: embedding,
      timestamp: Date.now(),
      ttl: this.DEFAULT_TTL,
    });

    // 清理过期缓存
    this.cleanupCache(this.embeddingCache);

    return embedding;
  }

  /**
   * 获取检索结果缓存
   */
  static getResultCache(
    query: string,
    userId: string,
    filter: any,
    mode: string,
    topK: number
  ): any | null {
    const key = this.generateKey('result', query, userId, filter, mode, topK);
    const cached = this.resultCache.get(key);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('[RetrievalCache] Result cache hit');
      return cached.data;
    }

    return null;
  }

  /**
   * 设置检索结果缓存
   */
  static setResultCache(
    query: string,
    userId: string,
    filter: any,
    mode: string,
    topK: number,
    result: any,
    ttl: number = this.DEFAULT_TTL
  ): void {
    const key = this.generateKey('result', query, userId, filter, mode, topK);
    
    this.resultCache.set(key, {
      data: result,
      timestamp: Date.now(),
      ttl,
    });

    this.cleanupCache(this.resultCache);
  }

  /**
   * 清理过期缓存
   */
  private static cleanupCache<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size <= this.MAX_CACHE_SIZE) {
      return;
    }

    const now = Date.now();
    const entries = Array.from(cache.entries());

    // 删除过期的
    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp >= entry.ttl) {
        cache.delete(key);
      }
    });

    // 如果还是太大，删除最旧的
    if (cache.size > this.MAX_CACHE_SIZE) {
      const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = sorted.slice(0, cache.size - this.MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => cache.delete(key));
    }
  }

  /**
   * 清空所有缓存
   */
  static clearAll(): void {
    this.embeddingCache.clear();
    this.resultCache.clear();
    console.log('[RetrievalCache] All caches cleared');
  }

  /**
   * 获取缓存统计
   */
  static getStats(): {
    embeddingCacheSize: number;
    resultCacheSize: number;
  } {
    return {
      embeddingCacheSize: this.embeddingCache.size,
      resultCacheSize: this.resultCache.size,
    };
  }
}



