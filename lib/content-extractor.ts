/**
 * Content Extractor - 智能内容提取器
 * 使用Mozilla Readability提取网页正文，自动过滤广告、侧边栏、评论等噪音
 */

import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { JSDOM } from 'jsdom';

export interface ExtractedContent {
  title: string;
  content: string;
  type: 'markdown' | 'text';
  metadata: {
    wordCount?: number;
    readingTime?: number;
    imageCount?: number;
    sourceQuality: 'high' | 'medium' | 'low';
    extractedAt: number;
  };
}

export interface ExtractionOptions {
  minContentLength?: number;
  preserveClasses?: string[];
  removeRecommendations?: boolean;
  useJina?: boolean;
}

export class ContentExtractor {
  private turndown: TurndownService;
  private purify: ReturnType<typeof createDOMPurify>;

  constructor() {
    const purifyWindow = new JSDOM('').window as unknown as Parameters<typeof createDOMPurify>[0];
    this.purify = createDOMPurify(purifyWindow);
    this.turndown = new TurndownService({
      headingStyle: 'atx',          // Use # headers
      codeBlockStyle: 'fenced',     // Use ``` code blocks
      hr: '---',                    // Horizontal rule
      bulletListMarker: '-',        // Use - for lists
      emDelimiter: '_',             // Use _ for emphasis
      strongDelimiter: '**',        // Use ** for strong
      linkStyle: 'inlined',         // Inline links
    });

    this.turndown.use(gfm);

    // 添加规则：保留图片说明文字
    this.turndown.addRule('figcaption', {
      filter: 'figcaption',
      replacement: (content) => {
        return `\n\n*${content.trim()}*\n\n`;
      }
    });

    // 添加规则：更好地处理图片
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement;
        const alt = img.alt || '';
        const src = img.src || '';
        const title = img.title || '';
        const titlePart = title ? ` "${title}"` : '';
        return src ? `![${alt}](${src}${titlePart})` : '';
      }
    });
  }

  /**
   * 从URL提取内容
   */
  async extractFromUrl(url: string, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    const {
      minContentLength = 500,
      preserveClasses = [],
      removeRecommendations = true,
      useJina = true,
    } = options;

    // 0. 尝试使用 Jina Reader
    if (useJina) {
      try {
        return await this.extractFromJina(url);
      } catch (error) {
        console.warn('Jina Reader failed, falling back to local extraction:', error);
      }
    }

    // 1. 获取HTML
    const html = await this.fetchHtml(url);

    // 2. 解析并提取正文
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // 3. 使用Readability提取
    const article = new Readability(document, {
      charThreshold: minContentLength,
      classesToPreserve: ['markdown', 'content', 'article', 'post', ...preserveClasses],
      debug: false,
    }).parse();

    if (!article || !article.content) {
      throw new Error('无法提取正文内容，可能是网站不支持或内容过短');
    }

    // 4. 清理HTML（移除XSS风险）
    const cleanHtml = this.purify.sanitize(article.content, {
      ALLOWED_TAGS: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'strong', 'em', 'a', 'img',
        'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'br', 'sub', 'sup'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
      ALLOW_DATA_ATTR: false,
    });

    // 5. 转换为Markdown
    let markdown = this.turndown.turndown(cleanHtml);

    // 6. 后处理
    markdown = this.postProcess(markdown, url, { removeRecommendations });

    // 7. 生成元数据
    const metadata = this.generateMetadata(markdown, article);

    return {
      title: article.title || this.extractTitle(html),
      content: markdown,
      type: 'markdown',
      metadata,
    };
  }

  /**
   * 使用 Jina Reader 提取内容
   */
  private async extractFromJina(url: string): Promise<ExtractedContent> {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Jina Reader error: ${response.statusText}`);
    }

    const markdown = await response.text();

    // 智能提取标题（多种策略）
    const title = this.extractTitleFromMarkdown(markdown, url);

    // 生成元数据
    const metadata = this.generateMetadata(markdown, { title });

    return {
      title,
      content: markdown,
      type: 'markdown',
      metadata,
    };
  }

  /**
   * 从Markdown中智能提取标题
   */
  private extractTitleFromMarkdown(markdown: string, url: string): string {
    // 策略1: 第一个#标题
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    // 策略2: 任何级别的标题
    const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();

    // 策略3: 第一段文字（最多100字）
    const firstParagraph = markdown.split('\n\n')[0]?.replace(/[#*`]/g, '').trim();
    if (firstParagraph && firstParagraph.length > 10) {
      return firstParagraph.slice(0, 100) + (firstParagraph.length > 100 ? '...' : '');
    }

    // 策略4: URL域名 + 路径
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/\/$/, '').split('/').pop();
      if (path) {
        return path.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      return urlObj.hostname.replace('www.', '').split('.')[0];
    } catch {
      // 策略5: 当前时间戳
      return `文章 ${new Date().toLocaleDateString()}`;
    }
  }

  /**
   * 从HTML字符串提取内容（用于特殊适配器）
   */
  extractFromHtml(html: string, url: string, options: ExtractionOptions = {}): ExtractedContent {
    const {
      removeRecommendations = true,
    } = options;

    // 1. 使用Readability解析
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    const article = new Readability(document).parse();

    if (!article || !article.content) {
      throw new Error('无法从HTML提取正文内容');
    }

    // 2. 清理并转换
    const cleanHtml = this.purify.sanitize(article.content, {
      ALLOWED_TAGS: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'strong', 'em', 'a', 'img',
        'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'br', 'sub', 'sup'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
      ALLOW_DATA_ATTR: false,
    });
    let markdown = this.turndown.turndown(cleanHtml);

    // 3. 后处理
    markdown = this.postProcess(markdown, url, { removeRecommendations });

    // 4. 生成元数据
    const metadata = this.generateMetadata(markdown, article);

    return {
      title: article.title || this.extractTitle(html),
      content: markdown,
      type: 'markdown',
      metadata,
    };
  }

  /**
   * 后处理：优化Markdown质量
   */
  private postProcess(
    markdown: string,
    baseUrl: string,
    options: { removeRecommendations?: boolean }
  ): string {
    let processed = markdown;

    // 1. 移除过多的空行（最多保留2个连续空行）
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // 2. 修复相对路径的图片链接
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      try {
        // 如果是相对路径，转为绝对路径
        if (!src.startsWith('http') && !src.startsWith('data:')) {
          const absolute = new URL(src, baseUrl).href;
          return `![${alt}](${absolute})`;
        }
        return match;
      } catch {
        return match;
      }
    });

    // 3. 修复相对路径的普通链接
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
      try {
        if (!href.startsWith('http') && !href.startsWith('#')) {
          const absolute = new URL(href, baseUrl).href;
          return `[${text}](${absolute})`;
        }
        return match;
      } catch {
        return match;
      }
    });

    if (options.removeRecommendations) {
      // 4. 移除常见的推广噪音（中文）
      const noisePatternsCN = [
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
      ];

      noisePatternsCN.forEach(pattern => {
        processed = processed.replace(pattern, '');
      });

      // 5. 移除常见的推广噪音（英文）
      const noisePatternsEN = [
        /Recommended for you[^\n]*/gi,
        /Related articles[^\n]*/gi,
        /Share this[^\n]*/gi,
        /Follow us[^\n]*/gi,
        /Subscribe to[^\n]*/gi,
      ];

      noisePatternsEN.forEach(pattern => {
        processed = processed.replace(pattern, '');
      });
    }

    // 6. 修复列表格式（移除空列表项）
    processed = processed.replace(/^(\s*)[-*+]\s*$/gm, '');

    // 7. 清理首尾空白
    processed = processed.trim();

    // 8. 移除连续的空列表
    processed = processed.replace(/^\n{2,}/gm, '\n');

    return processed;
  }

  /**
   * 生成内容元数据
   */
  private generateMetadata(markdown: string, article: any) {
    // 估算字数（中文按字符，英文按单词）
    const chineseChars = (markdown.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (markdown.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    // 估算阅读时间（中文400字/分钟，英文200词/分钟）
    const readingTimeMinutes = Math.ceil((chineseChars / 400) + (englishWords / 200));

    // 统计图片数量
    const imageCount = (markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;

    // 评估内容质量
    const sourceQuality = this.assessQuality(markdown, article);

    return {
      wordCount,
      readingTime: readingTimeMinutes,
      imageCount,
      sourceQuality,
      extractedAt: Date.now(),
    };
  }

  /**
   * 评估内容质量
   */
  private assessQuality(markdown: string, article: any): 'high' | 'medium' | 'low' {
    let score = 0;

    // 1. 检查是否有标题层级
    if (/^#{1,6}\s/.test(markdown)) score += 2;

    // 2. 检查是否有代码块
    if (/```/.test(markdown)) score += 1;

    // 3. 检查是否有列表
    if (/^\s*[-*+]\s/.test(markdown) || /^\s*\d+\.\s/.test(markdown)) score += 1;

    // 4. 检查是否有引用
    if (/^>/.test(markdown)) score += 1;

    // 5. 检查是否有图片
    if (/!\[/.test(markdown)) score += 1;

    // 6. 检查内容长度
    if (markdown.length > 2000) score += 2;
    else if (markdown.length > 1000) score += 1;

    // 7. 检查段落结构
    const paragraphs = markdown.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 3) score += 1;

    // 评分
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * 获取HTML页面
   */
  private async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      // 不缓存，确保获取最新内容
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * 从HTML中提取标题
   */
  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    return 'Untitled';
  }
}
