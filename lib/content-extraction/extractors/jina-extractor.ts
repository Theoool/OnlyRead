/**
 * Jina Reader 提取器 - 使用 Jina AI 的在线服务
 * 支持服务端和客户端
 */

import type { IContentExtractor, ExtractedContent, ExtractionOptions } from '../core/types';
import { noiseFilter } from '../filters/noise-filter';

export class JinaExtractor implements IContentExtractor {
  priority = 20; // 优先级高于本地提取

  supports(input: string | Document): boolean {
    // Jina 支持 URL 字符串
    return typeof input === 'string' && this.isValidUrl(input);
  }

  async extract(input: string | Document, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    if (typeof input !== 'string' || !this.isValidUrl(input)) {
      throw new Error('JinaExtractor only supports valid URL strings');
    }

    const url = input;
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/2.0)',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Jina Reader error: ${response.status} ${response.statusText}`);
    }

    let markdown = await response.text();

    // 智能提取标题
    const title = this.extractTitleFromMarkdown(markdown, url);

    // 清理 Jina 添加的元数据
    markdown = this.cleanJinaMetadata(markdown);

    // 应用后处理
    markdown = noiseFilter.postProcessText(markdown);

    if (options.removeRecommendations) {
      markdown = this.removeRecommendations(markdown);
    }

    const metadata = this.generateMetadata(markdown);

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
   * 从 Markdown 中提取标题
   */
  private extractTitleFromMarkdown(markdown: string, url: string): string {
    // 尝试提取 H1
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    // 尝试提取任何标题
    const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();

    // 使用第一段
    const firstParagraph = markdown.split('\n\n')[0]?.replace(/[#*`]/g, '').trim();
    if (firstParagraph && firstParagraph.length > 10) {
      return firstParagraph.slice(0, 100) + (firstParagraph.length > 100 ? '...' : '');
    }

    // 从 URL 生成标题
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/\/$/, '').split('/').pop();
      if (path) {
        return decodeURIComponent(path)
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      }
      return urlObj.hostname.replace('www.', '').split('.')[0];
    } catch {
      return `文章 ${new Date().toLocaleDateString()}`;
    }
  }

  /**
   * 清理 Jina 元数据
   */
  private cleanJinaMetadata(markdown: string): string {
    return markdown
      .replace(/^Title:.*$/m, '')
      .replace(/^URL Source:.*$/m, '')
      .replace(/^Markdown Content:.*$/m, '')
      .replace(/^\s*-\s*$/gm, '')
      .trim();
  }

  /**
   * 移除推荐内容
   */
  private removeRecommendations(markdown: string): string {
    const patterns = [
      /推荐阅读[^\n]*/g,
      /相关文章[^\n]*/g,
      /更多精彩[^\n]*/g,
      /关注公众号[^\n]*/g,
      /扫码关注[^\n]*/g,
      /点击原文[^\n]*/g,
      /分享到：[^\n]*/g,
      /本文首发于[^\n]*/g,
      /转载请注明[^\n]*/g,
      /商业转载[^\n]*/g,
      /Recommended for you[^\n]*/gi,
      /Related articles[^\n]*/gi,
      /Share this[^\n]*/gi,
      /Follow us[^\n]*/gi,
      /Subscribe to[^\n]*/gi,
    ];

    let cleaned = markdown;
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * 生成元数据
   */
  private generateMetadata(markdown: string): ExtractedContent['metadata'] {
    const chineseChars = (markdown.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (markdown.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    const readingTimeMinutes = Math.ceil((chineseChars / 400) + (englishWords / 200));

    const imageCount = (markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
    const linkCount = (markdown.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const codeBlockCount = (markdown.match(/```[\s\S]*?```/g) || []).length;

    return {
      wordCount,
      readingTime: readingTimeMinutes,
      imageCount,
      linkCount,
      codeBlockCount,
      sourceQuality: this.assessQuality(markdown),
      extractedAt: Date.now(),
      extractionMethod: 'jina',
    };
  }

  /**
   * 评估质量
   */
  private assessQuality(markdown: string): 'high' | 'medium' | 'low' {
    let score = 0;

    if (/^#{1,6}\s/.test(markdown)) score += 2;
    if (/```/.test(markdown)) score += 1;
    if (/^\s*[-*+]\s/.test(markdown) || /^\s*\d+\.\s/.test(markdown)) score += 1;
    if (/^>/.test(markdown)) score += 1;
    if (/!\[/.test(markdown)) score += 1;
    if (markdown.length > 2000) score += 2;
    else if (markdown.length > 1000) score += 1;

    const paragraphs = markdown.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 3) score += 1;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
}

// 导出单例
export const jinaExtractor = new JinaExtractor();

