/**
 * 噪音过滤器 - 智能移除页面噪音元素
 * 优化：独立模块，可配置，高性能
 */

import type { IContentFilter, FilterOptions } from '../core/types';

// ============================================================================
// 噪音选择器配置
// ============================================================================

const NOISE_SELECTORS = {
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
} as const;

const TEXT_NOISE_PATTERNS = [
  // 中文噪音
  { pattern: /^(推荐阅读|相关文章|延伸阅读|热门文章|猜你喜欢|相关阅读)[：:]\s*/gm, weight: 1 },
  { pattern: /(关注|扫码|微信|公众号|二维码|订阅|分享|收藏|点赞|在看)[^\n]{0,30}/g, weight: 1 },
  { pattern: /(本文来源|文章来源|原文链接|本文链接)[：:][^\n]*/g, weight: 1 },
  { pattern: /(版权声明|免责声明|侵权投诉|法律顾问)[^\n]{0,50}/g, weight: 1 },
  { pattern: /(相关推荐)[：:][^\n]*/g, weight: 1 },
  { pattern: /(\d{1,2}分钟阅读|阅读\s*\d+|浏览\s*\d+)[^\n]*/g, weight: 0.8 },
  { pattern: /(编辑：|作者：|来源：|原标题：)[^\n]*/g, weight: 0.8 },
  { pattern: /(点击|戳|查看|访问)[^\n]{0,20}(原文|链接|这里|此处)[^\n]*/g, weight: 1 },

  // 英文噪音
  { pattern: /^(Related Articles?|Recommended|You May Also Like|More from)[：:]\s*/gim, weight: 1 },
  { pattern: /(Share this|Follow us|Subscribe to|Sign up for)[^\n]*/gi, weight: 1 },
  { pattern: /(Advertisement|Sponsored|Promoted|Partner Content)[^\n]*/gi, weight: 1 },
  { pattern: /(Originally published|Updated on|Posted on)[^\n]*/gi, weight: 0.8 },
  { pattern: /(Editor['']s note|About the author)[^\n]*/gi, weight: 0.8 },

  // 通用噪音
  { pattern: /\[?(Read more|Learn more|Continue reading|Click here)\]?[^\n]*/gi, weight: 1 },
  { pattern: /\[?(Back to top|Scroll to top|Top)\]?[^\n]*/gi, weight: 1 },
  { pattern: /<!--.*?-->/g, weight: 1 },
  { pattern: /\[\s*(\d{1,2})\s*\]/g, weight: 0.5 },
  { pattern: /^\s*Photo by\s+.*$/gim, weight: 0.8 },
  { pattern: /^\s*Image:?\s*.*$/gim, weight: 0.8 },
] as const;

// ============================================================================
// 噪音过滤器实现
// ============================================================================

export class NoiseFilter implements IContentFilter {
  private selectorCache = new Map<string, string[]>();

  /**
   * 过滤文档中的噪音元素
   */
  filter(document: Document, options: FilterOptions = {}): Document {
    const {
      aggressive = false,
      preserveComments = false,
      preserveRelated = false,
      customSelectors = [],
      siteSpecificRules
    } = options;

    // 应用站点特定规则
    const hostname = this.getHostname(document.baseURI);
    const siteRule = siteSpecificRules?.get(hostname);

    if (siteRule?.transform) {
      siteRule.transform(document);
    }

    // 构建并缓存选择器列表
    const cacheKey = this.buildCacheKey(options);
    let selectors = this.selectorCache.get(cacheKey);
    
    if (!selectors) {
      selectors = this.buildSelectorList({
        aggressive,
        preserveComments,
        preserveRelated,
        customSelectors,
        siteRule
      });
      this.selectorCache.set(cacheKey, selectors);
    }

    // 移除噪音节点
    this.removeNodes(document, selectors);

    // 激进模式：移除低密度内容块
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

  /**
   * 后处理文本内容
   */
  postProcessText(text: string): string {
    let cleaned = text;

    // 应用文本噪音模式
    for (const { pattern } of TEXT_NOISE_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    // 标准化格式
    cleaned = this.normalizeFormatting(cleaned);

    return cleaned.trim();
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private buildCacheKey(options: FilterOptions): string {
    return JSON.stringify({
      aggressive: options.aggressive,
      preserveComments: options.preserveComments,
      preserveRelated: options.preserveRelated,
      customSelectors: options.customSelectors,
    });
  }

  private getHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private buildSelectorList(options: {
    aggressive?: boolean;
    preserveComments?: boolean;
    preserveRelated?: boolean;
    customSelectors?: string[];
    siteRule?: any;
  }): string[] {
    const selectors: string[] = [];
    const { aggressive, preserveComments, preserveRelated, customSelectors, siteRule } = options;

    // 基础噪音选择器
    selectors.push(
      ...NOISE_SELECTORS.navigation,
      ...NOISE_SELECTORS.sidebar,
      ...NOISE_SELECTORS.social,
      ...NOISE_SELECTORS.ads,
      ...NOISE_SELECTORS.footer,
      ...NOISE_SELECTORS.interactive,
      ...NOISE_SELECTORS.hidden
    );

    if (!preserveComments) {
      selectors.push(...NOISE_SELECTORS.comments);
    }

    if (!preserveRelated) {
      selectors.push(...NOISE_SELECTORS.recommendations);
    }

    // 激进模式选择器
    if (aggressive) {
      selectors.push(
        'div:has(> script)',
        'div:has(> iframe)',
        'section:has(.sponsored)'
      );
    }

    // 站点特定选择器
    if (siteRule?.removeSelectors) {
      selectors.push(...siteRule.removeSelectors);
    }

    // 自定义选择器
    if (customSelectors) {
      selectors.push(...customSelectors);
    }

    return [...new Set(selectors)];
  }

  private removeNodes(document: Document, selectors: string[]): void {
    for (const selector of selectors) {
      try {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          if (!this.containsValidContent(node)) {
            node.remove();
          }
        }
      } catch {
        // 无效选择器，跳过
      }
    }
  }

  private containsValidContent(node: Element): boolean {
    const hasCode = node.querySelector('pre, code');
    const hasTable = node.querySelector('table');
    const hasImage = node.querySelector('img');
    const textLength = node.textContent?.length || 0;

    return Boolean((hasCode || hasTable || hasImage) && textLength > 100);
  }

  private removeLowDensityBlocks(document: Document): void {
    const blocks = document.querySelectorAll('p, div');

    for (const block of blocks) {
      const text = block.textContent || '';
      const words = text.trim().split(/\s+/).length;
      const commas = (text.match(/,/g) || []).length;
      const tags = block.querySelectorAll('*').length;

      // 低密度判断：文字多但标点少，且标签密度高
      if (words > 50 && commas < 2 && tags > words / 10) {
        if (!block.querySelector('img, code, pre, table, blockquote')) {
          block.remove();
        }
      }
    }
  }

  private cleanEmptyNodes(root: Element): void {
    const voidElements = new Set([
      'BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK', 'AREA', 
      'BASE', 'COL', 'EMBED', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
    ]);

    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // 防止无限循环

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      const nodes = root.querySelectorAll('*');
      for (const node of nodes) {
        if (voidElements.has(node.tagName)) continue;

        const hasContent = node.textContent?.trim() || 
                          node.querySelector('img, video, iframe, canvas, svg');

        if (!hasContent && node.parentElement) {
          node.remove();
          changed = true;
        }
      }
    }
  }

  private normalizeFormatting(text: string): string {
    return text
      // 标准化分隔线
      .replace(/(\n---\n){2,}/g, '\n---\n')
      // 移除空列表项
      .replace(/^\s*[-*+]\s*$/gm, '')
      // 修复列表格式
      .replace(/^(\s*)[-*+]([^\s])/gm, '$1- $2')
      // 标准化空行
      .replace(/\n{3,}/g, '\n\n')
      // 移除行尾空格
      .replace(/[ \t]+$/gm, '')
      // 修复标题格式
      .replace(/^(#{1,6})([^#\s])/gm, '$1 $2')
      // 移除孤立的引用标记
      .replace(/^\s*\[\d+\]\s*$/gm, '')
      // 清理代码块格式
      .replace(/```language-(\w+)/g, '```$1')
      .replace(/```\n\n+/g, '```\n')
      .replace(/\n\n+```/g, '\n\n```')
      // 修复列表间距
      .replace(/^([-*+]\s.+)\n{2,}(?=[-*+]\s)/gm, '$1\n')
      // 移除无 alt 的图片
      .replace(/!\[\]\([^)]+\)/g, '')
      // 移除空链接
      .replace(/\[([^\]]+)\]\(\s*\)/g, '$1');
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.selectorCache.clear();
  }
}

// 导出单例
export const noiseFilter = new NoiseFilter();

