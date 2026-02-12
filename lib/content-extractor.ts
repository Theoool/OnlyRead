/**
 * Content Extractor - 智能内容提取器（增强版）
 * 基于 Mozilla Readability，支持智能 Markdown 转换和深度噪音过滤
 */

import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { JSDOM } from 'jsdom';
import pLimit from 'p-limit';

// ============================================================================
// 类型定义
// ============================================================================

export interface ExtractedContent {
  title: string;
  content: string;
  type: 'markdown' | 'text';
  metadata: {
    wordCount: number;
    readingTime: number;
    imageCount: number;
    linkCount: number;
    codeBlockCount: number;
    sourceQuality: 'high' | 'medium' | 'low';
    extractedAt: number;
    extractionMethod: 'jina' | 'readability';
  };
}

export interface ExtractionOptions {
  minContentLength?: number;
  preserveClasses?: string[];
  removeRecommendations?: boolean;
  useJina?: boolean;
  aggressiveNoiseRemoval?: boolean;
  preserveComments?: boolean;
  preserveRelated?: boolean;
  customSelectors?: string[];
  siteSpecificRules?: Map<string, SiteRule>;
  cacheEnabled?: boolean;
  cacheTtl?: number; // 毫秒
  maxConcurrency?: number;
}

export interface SiteRule {
  contentSelector?: string;
  removeSelectors?: string[];
  transform?: (doc: Document) => void;
  contentCallback?: (doc: Document) => void;
}

interface ImageProcessingOptions {
  preferDataSrc?: boolean;
  resolveRelativeUrls?: boolean;
  addDimensions?: boolean;
  maxWidth?: number;
}

// ============================================================================
// 噪音过滤器
// ============================================================================

class NoiseFilter {
  // 噪音选择器库（按类别分组）
  private static readonly NOISE_SELECTORS = {
    navigation: [
      'nav', 'header', '.header', '.nav', '.navbar', '.menu', 
      '.breadcrumb', '.breadcrumbs', '#nav', '#header', '.top-bar'
    ],
    sidebar: [
      'aside', '.sidebar', '.side-bar', '.widget', '.widgets',
      '.related-posts', '.popular-posts', '.recent-posts',
      '.tag-cloud', '.categories', '.archive', '.toc', '.table-of-contents'
    ],
    social: [
      '.share', '.sharing', '.social-share', '.social-media',
      '.follow-us', '.subscribe', '.newsletter', '.email-subscription',
      '.wechat', '.weixin', '.qr-code', '.qrcode'
    ],
    comments: [
      '.comments', '.comment-section', '.disqus', '#disqus_thread',
      '.giscus', '.utterances', '#comment', '.comment-list',
      '.fb-comments', '.remark42'
    ],
    ads: [
      '.ad', '.ads', '.advertisement', '.sponsored', '.promotion',
      '.affiliate', '.banner', '.popup', '.modal', '.overlay',
      '.google-ad', '.adsbygoogle', '[id*="google_ads"]'
    ],
    recommendations: [
      '.recommend', '.recommended', '.related', '.similar',
      '.you-may-like', '.more-articles', '.read-more',
      '.next-article', '.prev-article', '.pagination',
      '.post-navigation', '.nav-links'
    ],
    footer: [
      'footer', '.footer', '.copyright', '.legal', '.privacy-policy',
      '.terms-of-use', '.site-info', '.site-footer', '.bottom-bar'
    ],
    interactive: [
      '.cookie-consent', '.gdpr', '.popup-overlay', '.modal-backdrop',
      '.loading', '.spinner', '.back-to-top', '.scroll-top',
      '.floating-button', '.fixed-bar'
    ],
    hidden: [
      '[hidden]', '.hidden', '.invisible', '.sr-only', '.screen-reader',
      '[style*="display: none"]', '[style*="visibility: hidden"]',
      '[aria-hidden="true"]', '.d-none', '.hide'
    ]
  };

  // 文本模式噪音（正则表达式）
  private static readonly TEXT_NOISE_PATTERNS = [
    // 中文噪音
    { pattern: /^(推荐阅读|相关文章|延伸阅读|热门文章|猜你喜欢|相关阅读)[：:]\s*/gm },
    { pattern: /(关注|扫码|微信|公众号|二维码|订阅|分享|收藏|点赞|在看)[^\n]{0,30}/g },
    { pattern: /(本文来源|文章来源|原文链接|本文链接)[：:][^\n]*/g },
    { pattern: /(版权声明|免责声明|侵权投诉|法律顾问)[^\n]{0,50}/g },
    { pattern: /(上一篇|下一篇|相关推荐)[：:][^\n]*/g },
    { pattern: /(\d{1,2}分钟阅读|阅读\s*\d+|浏览\s*\d+)[^\n]*/g },
    { pattern: /(编辑：|作者：|来源：|原标题：)[^\n]*/g },
    { pattern: /(点击|戳|查看|访问)[^\n]{0,20}(原文|链接|这里|此处)[^\n]*/g },
    
    // 英文噪音
    { pattern: /^(Related Articles?|Recommended|You May Also Like|More from)[：:]\s*/gim },
    { pattern: /(Share this|Follow us|Subscribe to|Sign up for)[^\n]*/gi },
    { pattern: /(Advertisement|Sponsored|Promoted|Partner Content)[^\n]*/gi },
    { pattern: /(Originally published|Updated on|Posted on)[^\n]*/gi },
    { pattern: /(Editor['']s note|About the author)[^\n]*/gi },
    
    // 通用噪音
    { pattern: /\[?(Read more|Learn more|Continue reading|Click here)\]?[^\n]*/gi },
    { pattern: /\[?(Back to top|Scroll to top|Top)\]?[^\n]*/gi },
    { pattern: /<!--.*?-->/gs },
    { pattern: /\[\s*(\d{1,2})\s*\]/g },
    { pattern: /^\s*Photo by\s+.*$/gim },
    { pattern: /^\s*Image:?\s*.*$/gim },
  ];

  filter(document: Document, options: {
    aggressive?: boolean;
    preserveComments?: boolean;
    preserveRelated?: boolean;
    customSelectors?: string[];
    siteSpecificRules?: Map<string, SiteRule>;
  } = {}): Document {
    const { 
      aggressive = false, 
      preserveComments = false,
      preserveRelated = false,
      customSelectors = [],
      siteSpecificRules 
    } = options;

    // 站点特定规则
    const hostname = new URL(document.baseURI).hostname;
    const siteRule = siteSpecificRules?.get(hostname);
    
    if (siteRule?.transform) {
      siteRule.transform(document);
    }

    // 构建选择器列表
    const selectorsToRemove = this.buildSelectorList({
      aggressive,
      preserveComments,
      preserveRelated,
      customSelectors,
      siteRule
    });
    
    this.removeNodes(document, selectorsToRemove);

    // 内容密度分析
    if (aggressive) {
      this.removeLowDensityBlocks(document);
    }

    // 清理空节点
    this.cleanEmptyNodes(document.body);

    // 站点特定回调
    if (siteRule?.contentCallback) {
      siteRule.contentCallback(document);
    }

    return document;
  }

  private buildSelectorList(options: any): string[] {
    const selectors: string[] = [];
    const { aggressive, preserveComments, preserveRelated, customSelectors, siteRule } = options;

    // 基础噪音
    selectors.push(
      ...NoiseFilter.NOISE_SELECTORS.navigation,
      ...NoiseFilter.NOISE_SELECTORS.sidebar,
      ...NoiseFilter.NOISE_SELECTORS.social,
      ...NoiseFilter.NOISE_SELECTORS.ads,
      ...NoiseFilter.NOISE_SELECTORS.footer,
      ...NoiseFilter.NOISE_SELECTORS.interactive,
      ...NoiseFilter.NOISE_SELECTORS.hidden
    );

    if (!preserveComments) {
      selectors.push(...NoiseFilter.NOISE_SELECTORS.comments);
    }
    if (!preserveRelated) {
      selectors.push(...NoiseFilter.NOISE_SELECTORS.recommendations);
    }

    if (aggressive) {
      selectors.push(
        'figure:has(figcaption:contains("Advertisement"))',
        'div:has(> img[src*="ad"])',
        'p:has(> a:only-child:contains("Click here"))',
        'div:has(> script)',
        'div:has(> iframe)',
        'div:has(> .adsbygoogle)',
        'section:has(.sponsored)'
      );
    }

    if (siteRule?.removeSelectors) {
      selectors.push(...siteRule.removeSelectors);
    }

    selectors.push(...customSelectors);

    return [...new Set(selectors)];
  }

  private removeNodes(document: Document, selectors: string[]) {
    selectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(node => {
          if (!this.containsValidContent(node)) {
            node.remove();
          }
        });
      } catch (e) {
        // 无效选择器，跳过
      }
    });
  }

  private containsValidContent(node: Element): boolean {
    const hasCode = node.querySelector('pre, code');
    const hasTable = node.querySelector('table');
    const hasImage = node.querySelector('img');
    const textLength = node.textContent?.length || 0;
    
    return (hasCode || hasTable || hasImage) && textLength > 100;
  }

  private removeLowDensityBlocks(document: Document) {
    const paragraphs = document.querySelectorAll('p, div');
    
    paragraphs.forEach(p => {
      const text = p.textContent || '';
      const words = text.trim().split(/\s+/).length;
      const commas = (text.match(/,/g) || []).length;
      const tags = p.querySelectorAll('*').length;
      
      if (words > 50 && commas < 2 && tags > words / 10) {
        if (!p.querySelector('img, code, pre, table, blockquote')) {
          p.remove();
        }
      }
    });
  }

  private cleanEmptyNodes(root: Element) {
    let changed = true;
    while (changed) {
      changed = false;
      const emptyNodes = root.querySelectorAll('*');
      emptyNodes.forEach(node => {
        const isVoid = ['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK', 'AREA', 'BASE', 'COL', 'EMBED', 'PARAM', 'SOURCE', 'TRACK', 'WBR'].includes(node.tagName);
        const hasContent = node.textContent?.trim() || node.querySelector('img, video, iframe, canvas, svg');
        
        if (!isVoid && !hasContent && node.parentElement) {
          node.remove();
          changed = true;
        }
      });
    }
  }

  postProcessText(markdown: string): string {
    let cleaned = markdown;

    NoiseFilter.TEXT_NOISE_PATTERNS.forEach(({ pattern }) => {
      cleaned = cleaned.replace(pattern, '');
    });

    cleaned = cleaned
      .replace(/(\n---\n){2,}/g, '\n---\n')
      .replace(/^\s*[-*+]\s*$/gm, '')
      .replace(/^(\s*)[-*+]([^\s])/gm, '$1- $2')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/^(#{1,6})([^#\s])/gm, '$1 $2')
      .replace(/^\s*\[\d+\]\s*$/gm, '')
      .replace(/```language-(\w+)/g, '```$1')
      .replace(/```\n\n+/g, '```\n')
      .replace(/\n\n+```/g, '\n\n```')
      .replace(/^([-*+]\s.+)\n{2,}(?=[-*+]\s)/gm, '$1\n')
      .replace(/!\[\]\([^)]+\)/g, '') // 移除无 alt 的图片
      .replace(/\[([^\]]+)\]\(\s*\)/g, '$1'); // 移除空链接

    return cleaned.trim();
  }
}

// ============================================================================
// 段落优化器
// ============================================================================

class ParagraphOptimizer {
  optimize(document: Document): Document {
    const paragraphs = Array.from(document.querySelectorAll('p'));
    
    for (let i = 0; i < paragraphs.length - 1; i++) {
      const current = paragraphs[i];
      const next = paragraphs[i + 1];
      
      if (!current.parentElement || !next.parentElement) continue;

      const currentText = current.textContent?.trim() || '';
      const nextText = next.textContent?.trim() || '';

      if (this.shouldMerge(currentText, nextText)) {
        current.textContent = currentText + ' ' + nextText;
        next.remove();
        i--; // 重新检查当前段落
      }
    }

    return document;
  }

  private shouldMerge(current: string, next: string): boolean {
    const hasOpenEnding = /[，：；,\-:;]$/.test(current) || 
                         !/[.!?。！？]$/.test(current);
    const nextStartsLower = /^[a-z\u4e00-\u9fa5]/.test(next);
    const isShort = current.length < 50 && next.length < 50;
    const currentEndsWithQuote = /["']$/.test(current);
    const nextStartsWithQuote = /^["']/.test(next);

    return (hasOpenEnding && nextStartsLower && isShort) || 
           (currentEndsWithQuote && nextStartsWithQuote);
  }
}

// ============================================================================
// 主类：ContentExtractor
// ============================================================================

export class ContentExtractor {
  private turndown: TurndownService;
  private purify: ReturnType<typeof createDOMPurify>;
  private noiseFilter: NoiseFilter;
  private paragraphOptimizer: ParagraphOptimizer;
  private cache: Map<string, { content: ExtractedContent; timestamp: number }>;
  private limit: ReturnType<typeof pLimit>;

  constructor() {
    const purifyWindow = new JSDOM('').window as unknown as Parameters<typeof createDOMPurify>[0];
    this.purify = createDOMPurify(purifyWindow);
    this.noiseFilter = new NoiseFilter();
    this.paragraphOptimizer = new ParagraphOptimizer();
    this.cache = new Map();
    this.limit = pLimit(5);
    
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      hr: '---',
      bulletListMarker: '-',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      fence: '```',
      br: '  \n',
      blankReplacement: (content, node) => {
        return node.isBlock ? '\n\n' : '';
      }
    });

    this.turndown.use(gfm);
    this.setupTurndownRules();
  }

  private setupTurndownRules() {
    // 1. 智能图片处理
    this.turndown.addRule('smartImages', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement;
        
        const src = img.dataset.src || 
                   img.dataset.original || 
                   img.dataset.lazySrc || 
                   img.src || '';
        
        if (!src || src.startsWith('data:image') || src.startsWith('blob:')) {
          return '';
        }

        const alt = this.escapeMarkdown(img.alt || '');
        const title = img.title ? ` "${this.escapeMarkdown(img.title)}"` : '';
        
        const width = img.width || img.dataset.width;
        const height = img.height || img.dataset.height;
        const sizeAttr = (width && height) ? ` =${width}x${height}` : '';
        
        const finalSrc = this.resolveUrl(src, img.baseURI);
        
        return `![${alt}](${finalSrc}${title}${sizeAttr})`;
      }
    });

    // 2. 图片说明
    this.turndown.addRule('figcaption', {
      filter: 'figcaption',
      replacement: (content) => {
        return `\n\n*${content.trim()}*\n\n`;
      }
    });

    // 3. 增强表格处理
    this.turndown.addRule('enhancedTables', {
      filter: 'table',
      replacement: (content, node) => {
        const table = node as HTMLTableElement;
        const hasSpan = table.querySelector('[colspan], [rowspan]');
        
        let markdown = '\n\n' + this.turndown.turndown(content) + '\n\n';
        
        if (hasSpan) {
          markdown += '> ⚠️ 原表格包含合并单元格，已转换为简化版本\n\n';
        }
        
        return markdown;
      }
    });

    // 4. 代码块增强
    this.turndown.addRule('enhancedCodeBlocks', {
      filter: 'pre',
      replacement: (content, node) => {
        const pre = node as HTMLPreElement;
        const code = pre.querySelector('code');
        
        let language = '';
        const className = code?.className || pre.className || '';
        const match = className.match(/language-(\w+)|lang-(\w+)|brush:\s*(\w+)/i);
        language = match?.[1] || match?.[2] || match?.[3] || '';
        
        if (!language && code) {
          language = code.dataset.language || 
                    code.dataset.lang || 
                    this.detectLanguageFromContent(code.textContent || '') || '';
        }
        
        const codeContent = code?.textContent || content;
        const cleanedCode = codeContent
          .replace(/^\s*\d+[:.)]\s/gm, '')
          .replace(/^\s*\d+\s*\|\s/gm, '')
          .replace(/^\s*\d+\s+/, '')
          .replace(/[ \t]+$/gm, '');
        
        return `\n\n\`\`\`${language}\n${cleanedCode.trim()}\n\`\`\`\n\n`;
      }
    });

    // 5. 智能链接处理
    this.turndown.addRule('smartLinks', {
      filter: 'a',
      replacement: (content, node) => {
        const anchor = node as HTMLAnchorElement;
        let href = anchor.href || '';
        const title = anchor.title ? ` "${this.escapeMarkdown(anchor.title)}"` : '';
        
        if (href.startsWith('javascript:') || href === '#' || !href) {
          return content;
        }
        
        if (!href.startsWith('http') && !href.startsWith('#')) {
          try {
            href = new URL(href, anchor.baseURI).href;
          } catch {
            // 保持原样
          }
        }
        
        // 清理追踪参数
        if (href.startsWith('http')) {
          try {
            const url = new URL(href);
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
             'fbclid', 'gclid', 'ttclid', 'si', 'feature'].forEach(param => {
              url.searchParams.delete(param);
            });
            href = url.toString();
          } catch {
            // URL 无效
          }
        }
        
        const linkText = content.trim() || anchor.textContent?.trim() || '';
        if (!linkText || linkText === href) {
          return `<${href}>`;
        }
        
        return `[${linkText}](${href}${title})`;
      }
    });

    // 6. 数学公式
    this.turndown.addRule('mathFormulas', {
      filter: (node) => {
        return node.nodeName === 'SPAN' && 
               (node.className.includes('math') || 
                node.className.includes('latex') ||
                node.className.includes('katex') ||
                node.className.includes('mathjax'));
      },
      replacement: (content) => `$${content}$`
    });

    // 7. 删除线
    this.turndown.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content) => `~~${content}~~`
    });

    // 8. 上标/下标
    this.turndown.addRule('superscript', {
      filter: 'sup',
      replacement: (content) => `<sup>${content}</sup>`
    });
    
    this.turndown.addRule('subscript', {
      filter: 'sub',
      replacement: (content) => `<sub>${content}</sub>`
    });

    // 9. 引用块增强
    this.turndown.addRule('enhancedBlockquote', {
      filter: 'blockquote',
      replacement: (content, node) => {
        const bq = node as HTMLQuoteElement;
        const cite = bq.cite;
        
        let markdown = content
          .split('\n')
          .map(line => line.trim() ? `> ${line}` : '>')
          .join('\n');
        
        if (cite) {
          markdown += `\n> — <${cite}>`;
        }
        
        return `\n\n${markdown}\n\n`;
      }
    });

    // 10. 视频嵌入
    this.turndown.addRule('videoEmbeds', {
      filter: (node) => {
        return node.nodeName === 'IFRAME' && 
               (node.getAttribute('src')?.includes('youtube') ||
                node.getAttribute('src')?.includes('vimeo') ||
                node.getAttribute('src')?.includes('bilibili'));
      },
      replacement: (content, node) => {
        const iframe = node as HTMLIFrameElement;
        const src = iframe.src;
        
        if (src.includes('youtube')) {
          const videoId = src.match(/embed\/([^?]+)/)?.[1];
          return videoId ? `\n\n[![YouTube Video](https://img.youtube.com/vi/${videoId}/0.jpg)](https://www.youtube.com/watch?v=${videoId})\n\n` : '';
        }
        
        if (src.includes('bilibili')) {
          const bvid = src.match(/bvid=([^&]+)/)?.[1] || src.match(/BV\w+/)?.[0];
          return bvid ? `\n\n[Bilibili Video](https://www.bilibili.com/video/${bvid})\n\n` : '';
        }
        
        return `\n\n[Video](${src})\n\n`;
      }
    });
  }

  private detectLanguageFromContent(content: string): string {
    const patterns = [
      { lang: 'python', pattern: /^(def |import |from |class .*:|print\(|# |if __name__)/m },
      { lang: 'javascript', pattern: /^(const |let |var |function |=> |console\.|document\.|window\.)/m },
      { lang: 'typescript', pattern: /^(interface |type |: string|: number|: boolean|export class)/m },
      { lang: 'java', pattern: /^(public class|private |protected |System\.out|import java\.)/m },
      { lang: 'html', pattern: /^(<div|<span|<p>|<img|<!DOCTYPE)/im },
      { lang: 'css', pattern: /^(\.[a-z]|\#[a-z]|@media|@import|body\s*\{)/m },
      { lang: 'bash', pattern: /^(\$ |sudo |apt |npm |git |curl |wget |echo )/m },
      { lang: 'json', pattern: /^\s*[\{\[][\s\S]*["'][\s\S]*["']\s*:/m },
      { lang: 'yaml', pattern: /^([a-z_]+:\s|-\s+[a-z]|---\s*$)/m },
      { lang: 'sql', pattern: /^(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|FROM|WHERE)/im },
      { lang: 'rust', pattern: /^(fn |let mut |impl |struct |use |mod |cargo)/m },
      { lang: 'go', pattern: /^(package |func |import \(\s*"|\tgo )/m },
    ];

    for (const { lang, pattern } of patterns) {
      if (pattern.test(content)) return lang;
    }
    return '';
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
  }

  private resolveUrl(src: string, baseUrl: string): string {
    if (!src) return '';
    if (src.startsWith('http')) return src;
    if (src.startsWith('//')) return `https:${src}`;
    try {
      return new URL(src, baseUrl).href;
    } catch {
      return src;
    }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  async extractFromUrl(url: string, options: ExtractionOptions = {}): Promise<ExtractedContent> {
    const {
      minContentLength = 500,
      preserveClasses = [],
      removeRecommendations = true,
      useJina = true,
      aggressiveNoiseRemoval = false,
      preserveComments = false,
      preserveRelated = false,
      customSelectors = [],
      siteSpecificRules,
      cacheEnabled = true,
      cacheTtl = 3600000, // 1小时
    } = options;

    // 检查缓存
    if (cacheEnabled) {
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        return cached.content;
      }
    }

    // 尝试 Jina Reader
    if (useJina) {
      try {
        const result = await this.extractFromJina(url, options);
        if (cacheEnabled) {
          this.cache.set(url, { content: result, timestamp: Date.now() });
        }
        return result;
      } catch (error) {
        console.warn('Jina Reader failed, falling back to Readability:', error);
      }
    }

    // 本地提取
    const result = await this.limit(async () => {
      const html = await this.fetchHtml(url);
      return this.extractFromHtml(html, url, {
        minContentLength,
        preserveClasses,
        removeRecommendations,
        aggressiveNoiseRemoval,
        preserveComments,
        preserveRelated,
        customSelectors,
        siteSpecificRules
      });
    });

    if (cacheEnabled) {
      this.cache.set(url, { content: result, timestamp: Date.now() });
    }

    return result;
  }

  async extractFromHtml(
    html: string, 
    url: string, 
    options: Omit<ExtractionOptions, 'useJina' | 'cacheEnabled' | 'cacheTtl' | 'maxConcurrency'> = {}
  ): Promise<ExtractedContent> {
    const {
      minContentLength = 500,
      preserveClasses = [],
      removeRecommendations = true,
      aggressiveNoiseRemoval = false,
      preserveComments = false,
      preserveRelated = false,
      customSelectors = [],
      siteSpecificRules
    } = options;

    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // 1. 噪音过滤
    this.noiseFilter.filter(document, {
      aggressive: aggressiveNoiseRemoval,
      preserveComments,
      preserveRelated: !removeRecommendations,
      customSelectors: preserveClasses.map(c => `.${c}`),
      siteSpecificRules
    });

    // 2. 段落优化
    this.paragraphOptimizer.optimize(document);

    // 3. Readability 提取
    const article = new Readability(document, {
      charThreshold: minContentLength,
      classesToPreserve: ['markdown', 'content', 'article', 'post', ...preserveClasses],
      debug: false,
    }).parse();

    if (!article || !article.content) {
      throw new Error('无法提取正文内容，可能是网站不支持或内容过短');
    }

    // 4. 清理 HTML
    const cleanHtml = this.purify.sanitize(article.content, {
      ALLOWED_TAGS: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'strong', 'em', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'br', 'sub', 'sup', 'del', 's', 'strike',
        'sup', 'sub', 'iframe'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id',
        'data-src', 'data-original', 'data-lazy-src',
        'data-language', 'data-lang',
        'width', 'height', 'loading', 'cite'
      ],
      ALLOW_DATA_ATTR: true,
    });

    // 5. 转换为 Markdown
    let markdown = this.turndown.turndown(cleanHtml);

    // 6. 后处理
    markdown = this.noiseFilter.postProcessText(markdown);
    markdown = this.postProcess(markdown, url, { removeRecommendations });

    // 7. 生成元数据
    const metadata = this.generateMetadata(markdown, article, 'readability');

    return {
      title: article.title || this.extractTitle(html),
      content: markdown,
      type: 'markdown',
      metadata,
    };
  }

  private async extractFromJina(url: string, options: ExtractionOptions): Promise<ExtractedContent> {
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)',
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
    markdown = markdown
      .replace(/^Title:.*$/m, '')
      .replace(/^URL Source:.*$/m, '')
      .replace(/^Markdown Content:.*$/m, '')
      .replace(/^\s*-\s*$/gm, '')
      .trim();

    // 应用后处理
    markdown = this.noiseFilter.postProcessText(markdown);
    markdown = this.postProcess(markdown, url, { 
      removeRecommendations: options.removeRecommendations 
    });

    const metadata = this.generateMetadata(markdown, { title, content: markdown }, 'jina');

    return {
      title,
      content: markdown,
      type: 'markdown',
      metadata,
    };
  }

  private extractTitleFromMarkdown(markdown: string, url: string): string {
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();

    const firstParagraph = markdown.split('\n\n')[0]?.replace(/[#*`]/g, '').trim();
    if (firstParagraph && firstParagraph.length > 10) {
      return firstParagraph.slice(0, 100) + (firstParagraph.length > 100 ? '...' : '');
    }

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

  private postProcess(
    markdown: string,
    baseUrl: string,
    options: { removeRecommendations?: boolean }
  ): string {
    let processed = markdown;

    // 修复相对路径
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      try {
        if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('#')) {
          const absolute = new URL(src, baseUrl).href;
          return `![${alt}](${absolute})`;
        }
        return match;
      } catch {
        return match;
      }
    });

    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
      try {
        if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
          const absolute = new URL(href, baseUrl).href;
          return `[${text}](${absolute})`;
        }
        return match;
      } catch {
        return match;
      }
    });

    // 移除推荐内容（如果启用）
    if (options.removeRecommendations) {
      const noisePatterns = [
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

      noisePatterns.forEach(pattern => {
        processed = processed.replace(pattern, '');
      });
    }

    // 最终清理
    processed = processed
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^(\s*)[-*+]\s*$/gm, '')
      .replace(/^\n{2,}/gm, '\n')
      .trim();

    return processed;
  }

  private generateMetadata(
    markdown: string, 
    article: any, 
    method: 'jina' | 'readability'
  ): ExtractedContent['metadata'] {
    const chineseChars = (markdown.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (markdown.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    const readingTimeMinutes = Math.ceil((chineseChars / 400) + (englishWords / 200));

    const imageCount = (markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
    const linkCount = (markdown.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const codeBlockCount = (markdown.match(/```[\s\S]*?```/g) || []).length;

    const sourceQuality = this.assessQuality(markdown, article);

    return {
      wordCount,
      readingTime: readingTimeMinutes,
      imageCount,
      linkCount,
      codeBlockCount,
      sourceQuality,
      extractedAt: Date.now(),
      extractionMethod: method,
    };
  }

  private assessQuality(markdown: string, article: any): 'high' | 'medium' | 'low' {
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
    if (article?.byline) score += 1;
    if (article?.excerpt) score += 1;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

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

  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim().replace(/[\n\r\t]/g, ' ');
    }
    return 'Untitled';
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  async extractBatch(
    urls: string[], 
    options: ExtractionOptions & { onProgress?: (current: number, total: number) => void } = {}
  ): Promise<(ExtractedContent | Error)[]> {
    const { onProgress, ...extractOptions } = options;
    const limit = pLimit(options.maxConcurrency || 5);
    
    let completed = 0;
    const total = urls.length;

    return Promise.all(
      urls.map((url, index) => 
        limit(async () => {
          try {
            const result = await this.extractFromUrl(url, extractOptions);
            completed++;
            onProgress?.(completed, total);
            return result;
          } catch (error) {
            completed++;
            onProgress?.(completed, total);
            return error instanceof Error ? error : new Error(String(error));
          }
        })
      )
    );
  }
}

// ============================================================================
// 预定义的站点规则（示例）
// ============================================================================

export const defaultSiteRules: Map<string, SiteRule> = new Map([
  ['zhihu.com', {
    removeSelectors: ['.RichContent-actions', '.ContentItem-actions', '.VoteButton'],
    contentCallback: (doc) => {
      // 处理知乎公式
      doc.querySelectorAll('.ztext-math').forEach(el => {
        const tex = el.getAttribute('data-tex');
        if (tex) el.textContent = `$${tex}$`;
      });
    }
  }],
  ['juejin.cn', {
    removeSelectors: ['.article-suspended-panel', '.author-info-block', '.comment-box'],
  }],
  ['medium.com', {
    removeSelectors: ['.meteredContent', '.js-postShareWidget', '.u-paddingBottom0'],
  }],
  ['mp.weixin.qq.com', {
    removeSelectors: ['#js_profile_qrcode', '.rich_media_tool', '.reward_area'],
    contentCallback: (doc) => {
      // 处理微信图片
      doc.querySelectorAll('img[data-src]').forEach(img => {
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) img.setAttribute('src', dataSrc);
      });
    }
  }],
  ['github.com', {
    contentSelector: '.repository-content, .markdown-body',
    removeSelectors: ['.file-header', '.BlobToolbar', '.js-permalink-shortcut'],
  }],
]);

// ============================================================================
// 导出默认实例
// ============================================================================

export const contentExtractor = new ContentExtractor();

// 设置默认站点规则
defaultSiteRules.forEach((rule, domain) => {
  // 使用方式：在 extractFromUrl 的 options 中传入 siteSpecificRules: defaultSiteRules
});
