/**
 * Optimized Site Adapters for Next.js 16
 * 函数式重构的站点适配器系统
 */

// 适配器配置类型
export interface SiteAdapterConfig {
  name: string;
  domainPattern: RegExp;
  selectors: {
    title?: string;
    content: string;
    exclude?: string[];
  };
  transformers?: {
    [key: string]: (element: Element) => string;
  };
}

// 优化的适配器工厂函数
export function createSiteAdapter(config: SiteAdapterConfig) {
  return {
    name: config.name,
    test: (url: string) => config.domainPattern.test(url),
    
    extract: (html: string) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 提取标题
      const titleElement = config.selectors.title 
        ? doc.querySelector(config.selectors.title)
        : doc.querySelector('title, meta[property="og:title"]');
      
      const title = titleElement?.textContent?.trim() || 
                   (titleElement instanceof HTMLMetaElement ? titleElement.content : '') ||
                   'Untitled';
      
      // 提取内容
      const contentElement = doc.querySelector(config.selectors.content);
      if (!contentElement) {
        return { content: '', title };
      }
      
      // 克隆并清理内容
      const cleanContent = cleanupContent(contentElement, config.selectors.exclude || []);
      
      // 应用转换器
      const transformedContent = applyTransformers(cleanContent, config.transformers || {});
      
      return {
        content: transformedContent,
        title
      };
    }
  };
}

// 内容清理函数
function cleanupContent(element: Element, excludeSelectors: string[]): string {
  const clone = element.cloneNode(true) as Element;
  
  // 移除噪音元素
  excludeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // 移除脚本和样式
  clone.querySelectorAll('script, style').forEach(el => el.remove());
  
  return clone.innerHTML;
}

// 转换器应用函数
function applyTransformers(content: string, transformers: Record<string, Function>): string {
  let result = content;
  
  Object.entries(transformers).forEach(([selector, transformer]) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      const elements = doc.querySelectorAll(selector);
      
      elements.forEach(element => {
        const transformed = transformer(element);
        if (transformed !== null && transformed !== undefined) {
          element.outerHTML = transformed;
        }
      });
      
      result = doc.body.innerHTML;
    } catch (error) {
      console.warn(`Transformer for ${selector} failed:`, error);
    }
  });
  
  return result;
}

// 预定义的高性能适配器
export const optimizedAdapters = {
  // 微信公众号优化版
  wechat: createSiteAdapter({
    name: 'WeChat Official Account',
    domainPattern: /mp\.weixin\.qq\.com/,
    selectors: {
      title: '.rich_media_title',
      content: '#js_content',
      exclude: [
        '[class*="qr_code"]',
        '[class*="recommend"]',
        '[class*="guide"]',
        '[id*="reward"]',
        '[class*="footer"]',
        '[class*="copyright"]'
      ]
    },
    transformers: {
      'img[data-src]': (element: Element) => {
        const img = element as HTMLImageElement;
        const dataSrc = img.dataset.src;
        if (dataSrc) {
          img.src = dataSrc;
          delete img.dataset.src;
        }
        return img.outerHTML;
      }
    }
  }),

  // 知乎优化版
  zhihu: createSiteAdapter({
    name: 'Zhihu',
    domainPattern: /zhihu\.com/,
    selectors: {
      title: '.Post-Title, h1',
      content: '.Post-RichText, .RichContent-inner',
      exclude: [
        '.AuthorInfo',
        '.ContentItem-actions',
        '.VoteButton',
        '.ShareMenu',
        '.RichMeta',
        '.Post-SideActions',
        '[class*="ad"]',
        '[class*="recommend"]'
      ]
    },
    transformers: {
      '.ztext-math': (el: Element) => {
        const tex = el.getAttribute('data-tex');
        return tex ? `$${tex}$` : el.outerHTML;
      }
    }
  }),

  // 掘金优化版
  juejin: createSiteAdapter({
    name: 'Juejin',
    domainPattern: /juejin\.cn/,
    selectors: {
      title: '.article-title, h1',
      content: '.markdown-body, .article-content',
      exclude: [
        '.article-suspended-panel',
        '.author-info-block',
        '.comment-box'
      ]
    }
  }),

  // Medium优化版
  medium: createSiteAdapter({
    name: 'Medium',
    domainPattern: /medium\.com/,
    selectors: {
      title: 'h1[data-post-title]',
      content: 'article',
      exclude: [
        '[data-action="show-modal"]',
        '.js-multirecommendCountButton',
        '.js-socialRecommendCountButton',
        '.js-menuOverlay',
        '[role="dialog"]'
      ]
    }
  }),

  // 通用适配器
  generic: createSiteAdapter({
    name: 'Generic',
    domainPattern: /.*/,
    selectors: {
      content: 'article, main, [class*="content"], [class*="post"]',
      exclude: [
        'nav',
        'footer',
        'aside',
        'script',
        'style',
        '[class*="ad"]',
        '[class*="sidebar"]'
      ]
    }
  })
};

// 适配器选择器
export function selectAdapter(url: string): ReturnType<typeof createSiteAdapter> | null {
  const adapters = [
    optimizedAdapters.wechat,
    optimizedAdapters.zhihu,
    optimizedAdapters.juejin,
    optimizedAdapters.medium
  ];
  
  return adapters.find(adapter => adapter.test(url)) || optimizedAdapters.generic;
}

// 批量处理函数
export async function batchExtract(
  urls: string[],
  htmlContents: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{ content: string; title: string; adapter: string }>> {
  const results: Array<{ content: string; title: string; adapter: string }> = [];
  let processed = 0;
  const total = urls.length;

  // 并行处理
  await Promise.all(
    urls.map(async (url, index) => {
      try {
        const adapter = selectAdapter(url);
        if (adapter && htmlContents[index]) {
          const result = adapter.extract(htmlContents[index]);
          results[index] = {
            content: result.content,
            title: result.title,
            adapter: adapter.name
          };
        } else {
          results[index] = { content: '', title: '', adapter: 'None' };
        }
      } catch (error) {
        results[index] = { content: '', title: '', adapter: 'Error' };
        console.error(`Extraction failed for ${url}:`, error);
      } finally {
        processed++;
        onProgress?.(processed, total);
      }
    })
  );

  return results;
}

// 缓存增强版本
export class CachedSiteAdapter {
  private cache = new Map<string, { content: string; title: string; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  async extractWithCache(url: string, html: string): Promise<{ content: string; title: string }> {
    const cacheKey = `${url}_${html.length}`;
    const cached = this.cache.get(cacheKey);
    
    // 10分钟缓存
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      return { content: cached.content, title: cached.title };
    }

    const adapter = selectAdapter(url);
    if (!adapter) {
      return { content: '', title: '' };
    }

    const result = adapter.extract(html);
    
    // 管理缓存大小
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(cacheKey, {
      content: result.content,
      title: result.title,
      timestamp: Date.now()
    });

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}
