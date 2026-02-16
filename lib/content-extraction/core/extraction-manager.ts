/**
 * 内容提取管理器 - 统一的提取接口
 * 支持多种提取策略，自动选择最佳方案
 */

import pLimit from 'p-limit';
import type {
  IContentExtractor,
  ICacheStrategy,
  ExtractedContent,
  ExtractionOptions,
  BatchExtractionResult,
  ExtractionError,
  EXTRACTION_ERRORS,
} from '../core/types';

export class ContentExtractionManager {
  private extractors: IContentExtractor[] = [];
  private cache: ICacheStrategy | null = null;
  private limit: ReturnType<typeof pLimit>;

  constructor(
    extractors: IContentExtractor[] = [],
    cache?: ICacheStrategy,
    maxConcurrency = 5
  ) {
    this.extractors = extractors.sort((a, b) => b.priority - a.priority);
    this.cache = cache || null;
    this.limit = pLimit(maxConcurrency);
  }

  /**
   * 注册提取器
   */
  registerExtractor(extractor: IContentExtractor): void {
    this.extractors.push(extractor);
    this.extractors.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 设置缓存策略
   */
  setCache(cache: ICacheStrategy): void {
    this.cache = cache;
  }

  /**
   * 从 URL 提取内容
   */
  async extractFromUrl(url: string, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    const cacheKey = this.getCacheKey(url, options);

    // 检查缓存
    if (options.cacheEnabled !== false && this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // 直接使用 markdown.new 提取器（最快）
      const extractor = this.findExtractor('markdown');
      if (extractor?.supports(url)) {
        const result = await extractor.extract(url, options);
        
        // 异步缓存（不阻塞返回）
        if (options.cacheEnabled !== false && this.cache) {
          this.cache.set(cacheKey, result, options.cacheTtl).catch(() => {});
        }

        return result;
      }

      throw new Error('No suitable extractor found');
    } catch (error) {
      const extractionError: ExtractionError = {
        code: 'EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        url,
        originalError: error instanceof Error ? error : undefined,
      };

      options.onError?.(extractionError);
      throw error;
    }
  }

  /**
   * 从 HTML 提取内容
   */
  async extractFromHtml(
    html: string,
    url?: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractedContent> {
    // 选择合适的提取器
    for (const extractor of this.extractors) {
      if (extractor.supports(html)) {
        try {
          return await extractor.extract(html, options);
        } catch (error) {
          console.warn(`提取器 ${extractor.constructor.name} 失败:`, error);
          // 继续尝试下一个提取器
        }
      }
    }

    throw new Error('没有可用的提取器支持此内容');
  }

  /**
   * 从 Document 提取内容
   */
  async extractFromDocument(
    document: Document,
    options: ExtractionOptions = {}
  ): Promise<ExtractedContent> {
    // 选择合适的提取器
    for (const extractor of this.extractors) {
      if (extractor.supports(document)) {
        try {
          return await extractor.extract(document, options);
        } catch (error) {
          console.warn(`提取器 ${extractor.constructor.name} 失败:`, error);
          // 继续尝试下一个提取器
        }
      }
    }

    throw new Error('没有可用的提取器支持此文档');
  }

  /**
   * 批量提取（极速版）
   */
  async extractBatch(
    urls: string[],
    options: ExtractionOptions = {}
  ): Promise<BatchExtractionResult> {
    const startTime = Date.now();
    const successful: ExtractedContent[] = [];
    const failed: Array<{ url: string; error: ExtractionError }> = [];

    const results = await Promise.allSettled(
      urls.map((url) =>
        this.limit(() => this.extractFromUrl(url, options))
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          url: urls[i],
          error: {
            code: 'EXTRACTION_FAILED',
            message: result.reason?.message || 'Unknown error',
            url: urls[i],
          },
        });
      }
    }

    return {
      successful,
      failed,
      totalProcessed: urls.length,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * 生成缓存键（简化版）
   */
  private getCacheKey(url: string, options: ExtractionOptions): string {
    return options.removeRecommendations ? `${url}:clean` : url;
  }

  /**
   * 查找提取器
   */
  private findExtractor(type: string): IContentExtractor | undefined {
    return this.extractors.find(e => 
      e.constructor.name.toLowerCase().includes(type.toLowerCase())
    );
  }

  /**
   * 清理缓存
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * 获取缓存大小
   */
  async getCacheSize(): Promise<number> {
    if (this.cache) {
      return await this.cache.size();
    }
    return 0;
  }
}

