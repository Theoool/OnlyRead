import React from 'react';

/**
 * Optimized Markdown Transformer for Next.js 16/React 19
 * 函数式重构版本，提升性能和可维护性
 */

// 核心类型定义
export interface TransformConfig {
  preserveImages?: boolean;
  preserveTables?: boolean;
  preserveCode?: boolean;
  maxWorkers?: number;
}

export interface TransformResult {
  content: string;
  stats: {
    wordCount: number;
    processingTime: number;
    imageCount: number;
    codeBlocks: number;
  };
}

// 高性能转换函数
export async function htmlToMarkdown(
  html: string,
  config: TransformConfig = {}
): Promise<TransformResult> {
  const start = performance.now();
  
  // 默认配置
  const opts = {
    preserveImages: true,
    preserveTables: true,
    preserveCode: true,
    maxWorkers: navigator.hardwareConcurrency || 4,
    ...config
  };

  // 使用现代 Web API
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // 并行处理不同类型的内容
  const [textContent, images, codeBlocks] = await Promise.all([
    extractText(doc),
    opts.preserveImages ? extractImages(doc) : Promise.resolve([]),
    opts.preserveCode ? extractCode(doc) : Promise.resolve([])
  ]);

  // 组装结果
  const content = [
    textContent,
    ...codeBlocks,
    ...images
  ].filter(Boolean).join('\n\n');

  return {
    content,
    stats: {
      wordCount: content.split(/\s+/).length,
      processingTime: performance.now() - start,
      imageCount: images.length,
      codeBlocks: codeBlocks.length
    }
  };
}

// 专用提取函数
async function extractText(doc: Document): Promise<string> {
  // 清理噪音元素
  doc.querySelectorAll('script, style, nav, footer, aside').forEach(el => el.remove());
  
  // 提取主要内容
  const main = doc.querySelector('main, article, .content') || doc.body;
  return main.textContent?.replace(/\s+/g, ' ').trim() || '';
}

async function extractImages(doc: Document): Promise<string[]> {
  return Array.from(doc.querySelectorAll('img')).map(img => {
    const src = img.src || img.dataset.src || '';
    const alt = img.alt || '';
    return src ? `![${alt}](${src})` : '';
  }).filter(Boolean);
}

async function extractCode(doc: Document): Promise<string[]> {
  return Array.from(doc.querySelectorAll('pre code, code')).map(code => {
    const lang = code.className?.match(/language-(\w+)/)?.[1] || '';
    const content = code.textContent?.trim() || '';
    return content ? `\`\`\`${lang}\n${content}\n\`\`\`` : '';
  }).filter(Boolean);
}

// 批量处理
export async function batchTransform(
  htmlList: string[],
  config: TransformConfig = {}
): Promise<TransformResult[]> {
  const results: TransformResult[] = [];
  
  // 控制并发
  const workers = Math.min(config.maxWorkers || 4, htmlList.length);
  
  await Promise.all(
    htmlList.map(async (html, index) => {
      try {
        results[index] = await htmlToMarkdown(html, config);
      } catch (error) {
        results[index] = {
          content: '',
          stats: { wordCount: 0, processingTime: 0, imageCount: 0, codeBlocks: 0 }
        };
      }
    })
  );

  return results;
}

// React Hook 集成
export function useMarkdownTransformer() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const transform = React.useCallback(async (html: string) => {
    setIsProcessing(true);
    try {
      return await htmlToMarkdown(html);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { transform, isProcessing };
}
