/**
 * 主入口文件 - 内容提取系统
 * 提供工厂函数和便捷导出
 */

// 核心类型
export type {
  ExtractedContent,
  ContentMetadata,
  ExtractionOptions,
  ExtractionProgress,
  ExtractionError,
  BatchExtractionResult,
  IContentExtractor,
  IContentFilter,
  IContentConverter,
  ICacheStrategy,
  SiteRule,
  ImageProcessingOptions,
} from './core/types';

// 核心管理器
export { ContentExtractionManager } from './core/extraction-manager';

// 提取器
export { JinaExtractor, jinaExtractor } from './extractors/jina-extractor';
export { BrowserExtractor, browserExtractor } from './extractors/browser-extractor';

// 过滤器
export { NoiseFilter, noiseFilter } from './filters/noise-filter';
export { ParagraphOptimizer, paragraphOptimizer } from './filters/paragraph-optimizer';

// 转换器
export { MarkdownConverter, markdownConverter } from './converters/markdown-converter';

// 缓存策略
export {
  MemoryCacheStrategy,
  IndexedDBCacheStrategy,
  TieredCacheStrategy,
  createCacheStrategy,
} from './cache/cache-strategy';

// ============================================================================
// 工厂函数 - 客户端使用
// ============================================================================

import { ContentExtractionManager } from './core/extraction-manager';
import { jinaExtractor } from './extractors/jina-extractor';
import { browserExtractor } from './extractors/browser-extractor';
import { createCacheStrategy } from './cache/cache-strategy';
import type { ExtractionOptions } from './core/types';

/**
 * 创建客户端内容提取器
 * 适用于浏览器环境
 */
export function createClientExtractor(options?: {
  enableCache?: boolean;
  cacheType?: 'memory' | 'indexeddb' | 'tiered';
  maxCacheSize?: number;
  cacheTtl?: number;
  maxConcurrency?: number;
}) {
  const {
    enableCache = true,
    cacheType = 'tiered',
    maxCacheSize = 100,
    cacheTtl = 3600000,
    maxConcurrency = 5,
  } = options || {};

  const cache = enableCache
    ? createCacheStrategy(cacheType, {
        maxSize: maxCacheSize,
        defaultTtl: cacheTtl,
        useIndexedDB: cacheType === 'tiered' || cacheType === 'indexeddb',
      })
    : undefined;

  const manager = new ContentExtractionManager(
    [jinaExtractor, browserExtractor],
    cache,
    maxConcurrency
  );

  return manager;
}

/**
 * 默认客户端实例
 */
export const clientExtractor = createClientExtractor();

/**
 * 便捷函数 - 从 URL 提取内容
 */
export async function extractFromUrl(url: string, options?: ExtractionOptions) {
  return clientExtractor.extractFromUrl(url, options);
}

/**
 * 便捷函数 - 从 Document 提取内容
 */
export async function extractFromDocument(document: Document, options?: ExtractionOptions) {
  return clientExtractor.extractFromDocument(document, options);
}

/**
 * 便捷函数 - 批量提取
 */
export async function extractBatch(urls: string[], options?: ExtractionOptions) {
  return clientExtractor.extractBatch(urls, options);
}

