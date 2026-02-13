/**
 * Markdown 转换器 - HTML 到 Markdown 的智能转换
 * 优化：独立模块，支持扩展规则
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { IContentConverter } from '../core/types';

export class MarkdownConverter implements IContentConverter {
  private turndown: TurndownService;

  constructor() {
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
      blankReplacement: (content, node: any) => {
        return node.isBlock ? '\n\n' : '';
      }
    });

    this.turndown.use(gfm);
    this.setupCustomRules();
  }

  /**
   * 转换 HTML 为 Markdown
   */
  convert(html: string, baseUrl?: string): string {
    return this.turndown.turndown(html);
  }

  getType(): 'markdown' {
    return 'markdown';
  }

  /**
   * 设置自定义转换规则
   */
  private setupCustomRules(): void {
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

    // 3. 增强代码块处理
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
            this.detectLanguage(code.textContent || '') || '';
        }

        const codeContent = code?.textContent || content;
        const cleanedCode = this.cleanCodeContent(codeContent);

        return `\n\n\`\`\`${language}\n${cleanedCode}\n\`\`\`\n\n`;
      }
    });

    // 4. 智能链接处理
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
        href = this.cleanTrackingParams(href);

        const linkText = content.trim() || anchor.textContent?.trim() || '';
        if (!linkText || linkText === href) {
          return `<${href}>`;
        }

        return `[${linkText}](${href}${title})`;
      }
    });

    // 5. 数学公式
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

    // 6. 删除线
    this.turndown.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (content) => `~~${content}~~`
    });

    // 7. 上标/下标
    this.turndown.addRule('superscript', {
      filter: 'sup',
      replacement: (content) => `<sup>${content}</sup>`
    });

    this.turndown.addRule('subscript', {
      filter: 'sub',
      replacement: (content) => `<sub>${content}</sub>`
    });

    // 8. 引用块增强
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

    // 9. 表格增强
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
  }

  /**
   * 检测代码语言
   */
  private detectLanguage(content: string): string {
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

  /**
   * 清理代码内容
   */
  private cleanCodeContent(code: string): string {
    return code
      .replace(/^\s*\d+[:.)]\s/gm, '') // 移除行号（带冒号或点）
      .replace(/^\s*\d+\s*\|\s/gm, '') // 移除行号（带竖线）
      .replace(/^\s*\d+\s+/, '') // 移除开头行号
      .replace(/[ \t]+$/gm, '') // 移除行尾空格
      .trim();
  }

  /**
   * 清理追踪参数
   */
  private cleanTrackingParams(url: string): string {
    if (!url.startsWith('http')) return url;

    try {
      const urlObj = new URL(url);
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ttclid', 'si', 'feature'
      ];

      trackingParams.forEach(param => urlObj.searchParams.delete(param));
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * 转义 Markdown 特殊字符
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
  }

  /**
   * 解析相对 URL
   */
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
}

// 导出单例
export const markdownConverter = new MarkdownConverter();

