/**
 * 服务端提取器 - 使用 Readability + JSDOM
 * 仅在 Node.js 环境中使用
 */

import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import type { IContentExtractor, ExtractedContent, ExtractionOptions } from '../core/types';
import { noiseFilter } from '../filters/noise-filter';
import { paragraphOptimizer } from '../filters/paragraph-optimizer';
import { markdownConverter } from '../converters/markdown-converter';

export class ServerExtractor implements IContentExtractor {
  priority = 10;
  private purify: ReturnType<typeof createDOMPurify>;

  constructor() {
    const purifyWindow = new JSDOM('').window as unknown as Parameters<typeof createDOMPurify>[0];
    this.purify = createDOMPurify(purifyWindow);
  }

  supports(input: string | Document): boolean {
    // 服务端支持 HTML 字符串
    return typeof input === 'string';
  }

  async extract(input: string | Document, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    if (typeof input !== 'string') {
      throw new Error('ServerExtractor only supports HTML string input');
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

    // 1. 创建 DOM
    const dom = new JSDOM(input, { url: 'http://localhost' });
    const document = dom.window.document;

    // 2. 噪音过滤
    noiseFilter.filter(document, {
      aggressive: aggressiveNoiseRemoval,
      preserveComments,
      preserveRelated: !removeRecommendations,
      customSelectors: preserveClasses.map(c => `.${c}`),
      siteSpecificRules
    });

    // 3. 段落优化
    paragraphOptimizer.optimize(document);

    // 4. Readability 提取
    const article = new Readability(document, {
      charThreshold: minContentLength,
      classesToPreserve: ['markdown', 'content', 'article', 'post', ...preserveClasses],
      debug: false,
    }).parse();

    if (!article || !article.content) {
      throw new Error('无法提取正文内容，可能是网站不支持或内容过短');
    }

    // 5. 清理 HTML
    const cleanHtml = this.purify.sanitize(article.content, {
      ALLOWED_TAGS: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'strong', 'em', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'br', 'sub', 'sup', 'del', 's', 'strike',
        'iframe'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id',
        'data-src', 'data-original', 'data-lazy-src',
        'data-language', 'data-lang',
        'width', 'height', 'loading', 'cite'
      ],
      ALLOW_DATA_ATTR: true,
    });

    // 6. 转换为 Markdown（如果需要）
    let content: string;
    let type: 'markdown' | 'text' | 'html';

    if (convertToMarkdown) {
      content = markdownConverter.convert(cleanHtml);
      content = noiseFilter.postProcessText(content);
      type = 'markdown';
    } else {
      content = cleanHtml;
      type = 'html';
    }

    // 7. 生成元数据
    const metadata = this.generateMetadata(content, article);

    return {
      title: article.title || this.extractTitle(input),
      content,
      type,
      metadata,
    };
  }

  /**
   * 生成内容元数据
   */
  private generateMetadata(content: string, article: any): ExtractedContent['metadata'] {
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    const readingTimeMinutes = Math.ceil((chineseChars / 400) + (englishWords / 200));

    const imageCount = (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
    const linkCount = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const codeBlockCount = (content.match(/```[\s\S]*?```/g) || []).length;

    const sourceQuality = this.assessQuality(content, article);

    return {
      wordCount,
      readingTime: readingTimeMinutes,
      imageCount,
      linkCount,
      codeBlockCount,
      sourceQuality,
      extractedAt: Date.now(),
      extractionMethod: 'readability',
      author: article.byline || undefined,
    };
  }

  /**
   * 评估内容质量
   */
  private assessQuality(content: string, article: any): 'high' | 'medium' | 'low' {
    let score = 0;

    if (/^#{1,6}\s/.test(content)) score += 2;
    if (/```/.test(content)) score += 1;
    if (/^\s*[-*+]\s/.test(content) || /^\s*\d+\.\s/.test(content)) score += 1;
    if (/^>/.test(content)) score += 1;
    if (/!\[/.test(content)) score += 1;
    if (content.length > 2000) score += 2;
    else if (content.length > 1000) score += 1;

    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 3) score += 1;
    if (article?.byline) score += 1;
    if (article?.excerpt) score += 1;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  /**
   * 从 HTML 中提取标题
   */
  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim().replace(/[\n\r\t]/g, ' ');
    }
    return 'Untitled';
  }
}

// 导出单例
export const serverExtractor = new ServerExtractor();

