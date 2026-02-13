/**
 * 浏览器提取器 - 使用浏览器原生 API
 * 仅在客户端使用，无需 JSDOM
 */

import type { IContentExtractor, ExtractedContent, ExtractionOptions } from '../core/types';
import { noiseFilter } from '../filters/noise-filter';
import { paragraphOptimizer } from '../filters/paragraph-optimizer';
import { markdownConverter } from '../converters/markdown-converter';

export class BrowserExtractor implements IContentExtractor {
  priority = 5;

  supports(input: string | Document): boolean {
    // 浏览器端支持 Document 对象
    return typeof window !== 'undefined' && input instanceof Document;
  }

  async extract(input: string | Document, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    if (!(input instanceof Document)) {
      throw new Error('BrowserExtractor only supports Document input');
    }

    const {
      minContentLength = 500,
      preserveClasses = [],
      removeRecommendations = true,
      aggressiveNoiseRemoval = false,
      preserveComments = false,
      preserveRelated = false,
      customSelectors = [],
      siteSpecificRules,
      convertToMarkdown = true,
    } = options;

    // 克隆文档以避免修改原始 DOM
    const document = input.cloneNode(true) as Document;

    // 1. 噪音过滤
    noiseFilter.filter(document, {
      aggressive: aggressiveNoiseRemoval,
      preserveComments,
      preserveRelated: !removeRecommendations,
      customSelectors: preserveClasses.map(c => `.${c}`),
      siteSpecificRules
    });

    // 2. 段落优化
    paragraphOptimizer.optimize(document);

    // 3. 提取主要内容
    const mainContent = this.extractMainContent(document, minContentLength);

    if (!mainContent) {
      throw new Error('无法提取正文内容');
    }

    // 4. 清理 HTML
    const cleanHtml = this.sanitizeHtml(mainContent);

    // 5. 转换为 Markdown（如果需要）
    let content: string;
    let type: 'markdown' | 'text' | 'html';

    if (convertToMarkdown) {
      content = markdownConverter.convert(cleanHtml, document.baseURI);
      content = noiseFilter.postProcessText(content);
      type = 'markdown';
    } else {
      content = cleanHtml;
      type = 'html';
    }

    // 6. 提取标题
    const title = this.extractTitle(document);

    // 7. 生成元数据
    const metadata = this.generateMetadata(content);

    return {
      title,
      content,
      type,
      metadata,
    };
  }

  /**
   * 提取主要内容
   */
  private extractMainContent(document: Document, minLength: number): string | null {
    // 尝试常见的内容选择器
    const selectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.markdown-body',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.length >= minLength) {
        return element.innerHTML;
      }
    }

    // 回退：使用 body
    const body = document.body;
    if (body && body.textContent && body.textContent.length >= minLength) {
      return body.innerHTML;
    }

    return null;
  }

  /**
   * 清理 HTML（简化版，不依赖 DOMPurify）
   */
  private sanitizeHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;

    // 移除脚本和样式
    div.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    // 移除事件处理器
    div.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return div.innerHTML;
  }

  /**
   * 提取标题
   */
  private extractTitle(document: Document): string {
    // 尝试多种方式提取标题
    const h1 = document.querySelector('h1');
    if (h1?.textContent) return h1.textContent.trim();

    const title = document.querySelector('title');
    if (title?.textContent) return title.textContent.trim();

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.getAttribute('content')) {
      return ogTitle.getAttribute('content')!.trim();
    }

    return 'Untitled';
  }

  /**
   * 生成元数据
   */
  private generateMetadata(content: string): ExtractedContent['metadata'] {
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    const readingTimeMinutes = Math.ceil((chineseChars / 400) + (englishWords / 200));

    const imageCount = (content.match(/!\[([^\]]*)\]\(([^)]+)\)|<img/g) || []).length;
    const linkCount = (content.match(/\[([^\]]+)\]\(([^)]+)\)|<a/g) || []).length;
    const codeBlockCount = (content.match(/```[\s\S]*?```|<pre/g) || []).length;

    return {
      wordCount,
      readingTime: readingTimeMinutes,
      imageCount,
      linkCount,
      codeBlockCount,
      sourceQuality: this.assessQuality(content),
      extractedAt: Date.now(),
      extractionMethod: 'browser',
    };
  }

  /**
   * 评估质量
   */
  private assessQuality(content: string): 'high' | 'medium' | 'low' {
    let score = 0;

    if (/^#{1,6}\s|<h[1-6]/i.test(content)) score += 2;
    if (/```|<pre/i.test(content)) score += 1;
    if (/^\s*[-*+]\s|<[uo]l/i.test(content)) score += 1;
    if (/^>|<blockquote/i.test(content)) score += 1;
    if (/!\[|<img/i.test(content)) score += 1;
    if (content.length > 2000) score += 2;
    else if (content.length > 1000) score += 1;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
}

// 导出单例
export const browserExtractor = new BrowserExtractor();

