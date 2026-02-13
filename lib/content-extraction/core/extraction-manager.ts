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

    // 报告进度
    options.onProgress?.({
      stage: 'fetching',
      progress: 10,
      message: '正在获取内容...',
      currentUrl: url,
    });

    try {
      // 1. 尝试使用 Jina（如果启用）
      if (options.useJina !== false) {
        const jinaExtractor = this.findExtractor('jina');
        if (jinaExtractor?.supports(url)) {
          try {
            options.onProgress?.({
              stage: 'parsing',
              progress: 30,
              message: '使用 Jina Reader 提取...',
              currentUrl: url,
            });

            const result = await jinaExtractor.extract(url, options);
            
            options.onProgress?.({
              stage: 'complete',
              progress: 100,
              message: '提取完成',
              currentUrl: url,
            });

            // 缓存结果
            if (options.cacheEnabled !== false && this.cache) {
              await this.cache.set(cacheKey, result, options.cacheTtl);
            }

            return result;
          } catch (error) {
            console.warn('Jina Reader 失败，尝试本地提取:', error);
          }
        }
      }

      // 2. 获取 HTML
      options.onProgress?.({
        stage: 'fetching',
        progress: 40,
        message: '正在下载页面...',
        currentUrl: url,
      });

      const html = await this.fetchHtml(url);

      options.onProgress?.({
        stage: 'parsing',
        progress: 60,
        message: '正在解析内容...',
        currentUrl: url,
      });

      // 3. 使用本地提取器
      const result = await this.extractFromHtml(html, url, options);

      options.onProgress?.({
        stage: 'complete',
        progress: 100,
        message: '提取完成',
        currentUrl: url,
      });

      // 缓存结果
      if (options.cacheEnabled !== false && this.cache) {
        await this.cache.set(cacheKey, result, options.cacheTtl);
      }

      return result;
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
   * 批量提取
   */
  async extractBatch(
    urls: string[],
    options: ExtractionOptions = {}
  ): Promise<BatchExtractionResult> {
    const startTime = Date.now();
    const successful: ExtractedContent[] = [];
    const failed: Array<{ url: string; error: ExtractionError }> = [];

    let completed = 0;
    const total = urls.length;

    const results = await Promise.allSettled(
      urls.map((url) =>
        this.limit(async () => {
          try {
            const result = await this.extractFromUrl(url, {
              ...options,
              onProgress: (progress) => {
                options.onProgress?.({
                  ...progress,
                  progress: Math.floor(((completed + progress.progress / 100) / total) * 100),
                });
              },
            });
            completed++;
            return { success: true, url, result };
          } catch (error) {
            completed++;
            const extractionError: ExtractionError = {
              code: 'EXTRACTION_FAILED',
              message: error instanceof Error ? error.message : String(error),
              url,
              originalError: error instanceof Error ? error : undefined,
            };
            return { success: false, url, error: extractionError };
          }
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value.success) {
          successful.push(value.result);
        } else {
          failed.push({ url: value.url, error: value.error });
        }
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
   * 获取 HTML
   */
  private async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(url: string, options: ExtractionOptions): string {
    const optionsHash = JSON.stringify({
      minContentLength: options.minContentLength,
      aggressiveNoiseRemoval: options.aggressiveNoiseRemoval,
      preserveComments: options.preserveComments,
      preserveRelated: options.preserveRelated,
      convertToMarkdown: options.convertToMarkdown,
    });
    return `${url}:${optionsHash}`;
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

