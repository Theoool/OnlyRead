/**
 * Markdown.new 提取器 - 使用 markdown.new 的快速服务
 * 比 Jina 更快、更稳定
 */

import type { IContentExtractor, ExtractedContent, ExtractionOptions } from '../core/types';
import { noiseFilter } from '../filters/noise-filter';

export class MarkdownNewExtractor implements IContentExtractor {
  priority = 20; // 优先级高于本地提取

  supports(input: string | Document): boolean {
    return typeof input === 'string' && this.isValidUrl(input);
  }

  async extract(input: string | Document, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    if (typeof input !== 'string' || !this.isValidUrl(input)) {
      throw new Error('MarkdownNewExtractor only supports valid URL strings');
    }

    const url = input;
    const markdownNewUrl = `https://markdown.new/${url}`;

    const response = await fetch(markdownNewUrl, {
      headers: {
        'Accept': 'text/markdown,text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/3.0)',
      },
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`Markdown.new error: ${response.status} ${response.statusText}`);
    }

    let markdown = await response.text();

    // 快速提取标题
    const title = this.extractTitle(markdown, url);

    // 轻量级清理
    markdown = this.quickClean(markdown);

    // 最小化后处理
    if (options.removeRecommendations) {
      markdown = this.removeRecommendations(markdown);
    }

    const metadata = this.quickMetadata(markdown);

    return {
      title,
      content: markdown,
      type: 'markdown',
      metadata,
    };
  }

  /**
   * 验证 URL
   */
  private isValidUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 快速提取标题
   */
  private extractTitle(markdown: string, url: string): string {
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();

    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Untitled';
    }
  }

  /**
   * 快速清理
   */
  private quickClean(markdown: string): string {
    return markdown
      .replace(/^(Title|URL Source|Markdown Content):.*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 移除推荐内容（简化版）
   */
  private removeRecommendations(markdown: string): string {
    return markdown
      .replace(/推荐阅读[^\n]*/g, '')
      .replace(/相关文章[^\n]*/g, '')
      .replace(/Recommended for you[^\n]*/gi, '')
      .replace(/Related articles[^\n]*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 快速元数据生成
   */
  private quickMetadata(markdown: string): ExtractedContent['metadata'] {
    const length = markdown.length;
    const readingTime = Math.max(1, Math.ceil(length / 500));

    return {
      wordCount: length,
      readingTime,
      extractedAt: Date.now(),
      extractionMethod: 'markdown.new',
    };
  }
}

// 导出单例
export const markdownNewExtractor = new MarkdownNewExtractor();

// 保持向后兼容
export const jinaExtractor = markdownNewExtractor;
export { MarkdownNewExtractor as JinaExtractor };

