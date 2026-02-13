/**
 * 服务端入口文件 - 仅在 Node.js 环境使用
 * 包含 JSDOM 和 Readability 依赖
 */

// 核心类型
export type {
  ExtractedContent,
  ContentMetadata,
  ExtractionOptions,
  ExtractionProgress,
  ExtractionError,
  BatchExtractionResult,
} from './core/types';

// 核心管理器
export { ContentExtractionManager } from './core/extraction-manager';

// 服务端提取器
export { ServerExtractor, serverExtractor } from './extractors/server-extractor';
export { JinaExtractor, jinaExtractor } from './extractors/jina-extractor';

// 过滤器
export { NoiseFilter, noiseFilter } from './filters/noise-filter';
export { ParagraphOptimizer, paragraphOptimizer } from './filters/paragraph-optimizer';

// 转换器
export { MarkdownConverter, markdownConverter } from './converters/markdown-converter';

// 缓存策略（仅内存缓存）
export { MemoryCacheStrategy, createCacheStrategy } from './cache/cache-strategy';

// ============================================================================
// 工厂函数 - 服务端使用
// ============================================================================

import { ContentExtractionManager } from './core/extraction-manager';
import { serverExtractor } from './extractors/server-extractor';
import { jinaExtractor } from './extractors/jina-extractor';
import { createCacheStrategy } from './cache/cache-strategy';
import type { ExtractionOptions } from './core/types';

/**
 * 创建服务端内容提取器
 * 适用于 Node.js 环境
 */
export function createServerExtractor(options?: {
  enableCache?: boolean;
  maxCacheSize?: number;
  cacheTtl?: number;
  maxConcurrency?: number;
}) {
  const {
    enableCache = true,
    maxCacheSize = 200,
    cacheTtl = 3600000,
    maxConcurrency = 10,
  } = options || {};

  const cache = enableCache
    ? createCacheStrategy('memory', {
        maxSize: maxCacheSize,
        defaultTtl: cacheTtl,
      })
    : undefined;

  const manager = new ContentExtractionManager(
    [jinaExtractor, serverExtractor],
    cache,
    maxConcurrency
  );

  return manager;
}

/**
 * 默认服务端实例
 */
export const serverExtractor_instance = createServerExtractor();

/**
 * 便捷函数 - 从 URL 提取内容
 */
export async function extractFromUrl(url: string, options?: ExtractionOptions) {
  return serverExtractor_instance.extractFromUrl(url, options);
}

/**
 * 便捷函数 - 从 HTML 提取内容
 */
export async function extractFromHtml(html: string, url?: string, options?: ExtractionOptions) {
  return serverExtractor_instance.extractFromHtml(html, url, options);
}

/**
 * 便捷函数 - 批量提取
 */
export async function extractBatch(urls: string[], options?: ExtractionOptions) {
  return serverExtractor_instance.extractBatch(urls, options);
}

