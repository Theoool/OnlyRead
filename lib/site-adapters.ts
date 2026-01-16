/**
 * Site Adapters - 特殊网站适配器
 * 针对常见中文/英文网站进行专门的提取优化
 */

import { JSDOM } from 'jsdom';

export interface SiteAdapter {
  name: string;
  test: (url: string) => boolean;
  extract: (html: string, url: string) => { content: string; title?: string };
  priority?: number; // 优先级，数字越大优先级越高
}

/**
 * 微信公众号适配器
 */
const wechatAdapter: SiteAdapter = {
  name: 'WeChat Official Account',
  test: (url) => url.includes('mp.weixin.qq.com'),
  priority: 10,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 获取标题
    const titleEl = doc.querySelector('.rich_media_title') ||
                   doc.querySelector('meta[property="og:title"]');
    const title = titleEl?.textContent?.trim() ||
                  (titleEl instanceof HTMLMetaElement ? titleEl.content : '');

    // 获取正文
    const content = doc.querySelector('#js_content');
    if (!content) {
      return { content: '', title };
    }

    // 移除噪音元素
    const noiseSelectors = [
      '[class*="qr_code"]',
      '[class*="recommend"]',
      '[class*="guide"]',
      '[id*="reward"]',
      '[class*="footer"]',
      '[class*="copyright"]',
    ];

    noiseSelectors.forEach(selector => {
      content.querySelectorAll(selector).forEach(el => el.remove());
    });

    return {
      content: content.innerHTML,
      title,
    };
  },
};

/**
 * 知乎适配器
 */
const zhihuAdapter: SiteAdapter = {
  name: 'Zhihu',
  test: (url) => url.includes('zhihu.com'),
  priority: 9,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 获取标题
    const titleEl = doc.querySelector('.Post-Title') ||
                   doc.querySelector('h1') ||
                   doc.querySelector('meta[property="og:title"]');
    const title = titleEl?.textContent?.trim() ||
                  (titleEl instanceof HTMLMetaElement ? titleEl.content : '');

    // 获取正文（知乎有两种正文容器）
    const content = doc.querySelector('.Post-RichText') ||
                   doc.querySelector('.RichContent-inner') ||
                   doc.querySelector('[data-zop-foldlist="fold"]');

    if (!content) {
      return { content: '', title };
    }

    // 克隆内容以避免修改原DOM
    const clonedContent = content.cloneNode(true) as Element;

    // 移除噪音元素
    const noiseSelectors = [
      '.AuthorInfo',
      '.ContentItem-actions',
      '.VoteButton',
      '.ShareMenu',
      '.RichMeta',
      '.Post-SideActions',
      '[class*="ad"]',
      '[class*="recommend"]',
    ];

    noiseSelectors.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove());
    });

    return {
      content: clonedContent.innerHTML,
      title,
    };
  },
};

/**
 * 掘金适配器
 */
const juejinAdapter: SiteAdapter = {
  name: 'Juejin',
  test: (url) => url.includes('juejin.cn'),
  priority: 8,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 获取标题
    const titleEl = doc.querySelector('.article-title') ||
                   doc.querySelector('h1') ||
                   doc.querySelector('meta[property="og:title"]');
    const title = titleEl?.textContent?.trim() ||
                  (titleEl instanceof HTMLMetaElement ? titleEl.content : '');

    // 掘金文章通常是Markdown格式，可以直接提取
    const content = doc.querySelector('.markdown-body') ||
                   doc.querySelector('.article-content');

    if (!content) {
      return { content: '', title };
    }

    return {
      content: content.innerHTML,
      title,
    };
  },
};

/**
 * Medium适配器
 */
const mediumAdapter: SiteAdapter = {
  name: 'Medium',
  test: (url) => url.includes('medium.com'),
  priority: 7,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 获取标题
    const titleEl = doc.querySelector('h1[data-post-title]') ||
                   doc.querySelector('meta[property="og:title"]');
    const title = titleEl?.textContent?.trim() ||
                  (titleEl instanceof HTMLMetaElement ? titleEl.content : '');

    // Medium的article标签
    const content = doc.querySelector('article');

    if (!content) {
      return { content: '', title };
    }

    // 克隆内容
    const clonedContent = content.cloneNode(true) as Element;

    // 移除噪音
    const noiseSelectors = [
      '[data-action="show-modal"]',
      '.js-multirecommendCountButton',
      '.js-socialRecommendCountButton',
      '.js-menuOverlay',
      '[role="dialog"]',
    ];

    noiseSelectors.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove());
    });

    return {
      content: clonedContent.innerHTML,
      title,
    };
  },
};

/**
 * 知乎专栏适配器
 */
const zhihuZhuanlanAdapter: SiteAdapter = {
  name: 'Zhihu Zhuanlan',
  test: (url) => url.includes('zhuanlan.zhihu.com'),
  priority: 9,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 获取标题
    const titleEl = doc.querySelector('.Post-Title') ||
                   doc.querySelector('h1') ||
                   doc.querySelector('meta[property="og:title"]');
    const title = titleEl?.textContent?.trim() ||
                  (titleEl instanceof HTMLMetaElement ? titleEl.content : '');

    // 获取正文
    const content = doc.querySelector('.Post-RichText') ||
                   doc.querySelector('.RichContent-inner');

    if (!content) {
      return { content: '', title };
    }

    const clonedContent = content.cloneNode(true) as Element;

    // 移除噪音
    const noiseSelectors = [
      '.AuthorInfo',
      '.ContentItem-actions',
      '.VoteButton',
      '[class*="ad"]',
    ];

    noiseSelectors.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove());
    });

    return {
      content: clonedContent.innerHTML,
      title,
    };
  },
};

/**
 * 简书适配器
 */
const jianshuAdapter: SiteAdapter = {
  name: 'Jianshu',
  test: (url) => url.includes('jianshu.com'),
  priority: 6,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 获取标题
    const titleEl = doc.querySelector('h1.title') ||
                   doc.querySelector('meta[property="og:title"]');
    const title = titleEl?.textContent?.trim() ||
                  (titleEl instanceof HTMLMetaElement ? titleEl.content : '');

    // 获取正文
    const content = doc.querySelector('.show-content') ||
                   doc.querySelector('article');

    if (!content) {
      return { content: '', title };
    }

    const clonedContent = content.cloneNode(true) as Element;

    // 移除噪音
    clonedContent.querySelectorAll('[class*="ad"], [class*="note"]').forEach(el => el.remove());

    return {
      content: clonedContent.innerHTML,
      title,
    };
  },
};

/**
 * 通用博客适配器（针对WordPress等常见博客系统）
 */
const genericBlogAdapter: SiteAdapter = {
  name: 'Generic Blog',
  test: (url) => {
    // 不匹配其他特定适配器的网站
    const specificAdapters = [wechatAdapter, zhihuAdapter, juejinAdapter,
                             mediumAdapter, zhihuZhuanlanAdapter, jianshuAdapter];
    return !specificAdapters.some(adapter => adapter.test(url));
  },
  priority: 0,
  extract: (html, url) => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 尝试多种常见的正文选择器
    const contentSelectors = [
      'article',
      '[class*="content"]',
      '[class*="post"]',
      '[class*="entry"]',
      '[id*="content"]',
      '[id*="post"]',
      '[id*="article"]',
      'main',
    ];

    let content: Element | null = null;
    for (const selector of contentSelectors) {
      const el = doc.querySelector(selector);
      if (el && el.innerHTML.length > 500) {
        content = el;
        break;
      }
    }

    if (!content) {
      return { content: '', title: '' };
    }

    return {
      content: content.innerHTML,
      title: '',
    };
  },
};

/**
 * 所有适配器列表（按优先级排序）
 */
export const siteAdapters: SiteAdapter[] = [
  wechatAdapter,
  zhihuZhuanlanAdapter,
  zhihuAdapter,
  juejinAdapter,
  mediumAdapter,
  jianshuAdapter,
  genericBlogAdapter,
].sort((a, b) => (b.priority || 0) - (a.priority || 0));

/**
 * 获取适用的适配器
 */
export function getAdapterForUrl(url: string): SiteAdapter | null {
  return siteAdapters.find(adapter => adapter.test(url)) || null;
}

/**
 * 使用适配器提取内容
 */
export function extractWithAdapter(
  html: string,
  url: string
): { content: string; title?: string; adapterName?: string } {
  const adapter = getAdapterForUrl(url);

  if (!adapter) {
    return { content: '', title: '' };
  }

  const result = adapter.extract(html, url);
  return {
    ...result,
    adapterName: adapter.name,
  };
}
