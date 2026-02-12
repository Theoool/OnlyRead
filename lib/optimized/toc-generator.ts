/**
 * Optimized TOC Generator for Next.js 16
 * 高性能目录生成器
 */

// 目录项接口
export interface TOCItem {
  id: string;
  title: string;
  level: number;
  children?: TOCItem[];
  position: number;
  index: number;
}

// 生成结果接口
export interface TOCResult {
  items: TOCItem[];
  metadata: {
    totalItems: number;
    maxDepth: number;
    estimatedReadingTime: number;
  };
}

// 高性能目录生成函数
export function generateTOCOptimized(markdown: string): TOCResult {
  const start = performance.now();
  
  if (!markdown?.trim()) {
    return {
      items: [],
      metadata: {
        totalItems: 0,
        maxDepth: 0,
        estimatedReadingTime: 0
      }
    };
  }

  const lines = markdown.split('\n');
  const items: TOCItem[] = [];
  let currentIndex = 0;
  let currentPosition = 0;
  let maxDepth = 1;

  // 使用 Map 优化查找性能
  const levelStack: Map<number, TOCItem[]> = new Map();
  levelStack.set(0, items);

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const id = `heading-${currentIndex}`;

      const tocItem: TOCItem = {
        id,
        title,
        level,
        position: currentPosition,
        index: currentIndex++
      };

      // 更新最大深度
      if (level > maxDepth) maxDepth = level;

      // 找到正确的父级
      let parentLevel = level - 1;
      while (parentLevel >= 0 && !levelStack.has(parentLevel)) {
        parentLevel--;
      }

      if (parentLevel >= 0) {
        const parentItems = levelStack.get(parentLevel)!;
        const parentItem = parentItems[parentItems.length - 1];
        
        if (parentItem) {
          if (!parentItem.children) parentItem.children = [];
          parentItem.children.push(tocItem);
          levelStack.set(level, parentItem.children);
        }
      } else {
        items.push(tocItem);
        levelStack.set(level, items);
      }
    }

    currentPosition += line.length + 1;
  }

  // 计算阅读时间（中文约400词/分钟，英文约200词/分钟）
  const chineseChars = (markdown.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (markdown.match(/[a-zA-Z]+/g) || []).length;
  const estimatedReadingTime = Math.ceil((chineseChars / 400) + (englishWords / 200));

  return {
    items,
    metadata: {
      totalItems: currentIndex,
      maxDepth,
      estimatedReadingTime
    }
  };
}

// 扁平化目录（用于渲染）
export function flattenTOC(items: TOCItem[], level = 0): (TOCItem & { flattenLevel: number })[] {
  const result: (TOCItem & { flattenLevel: number })[] = [];

  for (const item of items) {
    result.push({ ...item, flattenLevel: level });
    if (item.children) {
      result.push(...flattenTOC(item.children, level + 1));
    }
  }

  return result;
}

// 查找位置对应的句子
export function findSentenceByPosition(sentences: string[], position: number): number {
  let currentPos = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    currentPos += sentences[i].length;
    if (currentPos >= position) {
      return i;
    }
  }
  
  return 0;
}

// 生成简单目录（扁平结构）
export function generateSimpleTOC(markdown: string): Array<{
  title: string;
  level: number;
  index: number;
  flattenLevel?: number;
}> {
  const { items } = generateTOCOptimized(markdown);
  return flattenTOC(items).map(item => ({
    title: item.title,
    level: item.level,
    index: item.index,
    flattenLevel: item.flattenLevel
  }));
}

// 目录搜索功能
export function searchTOC(items: TOCItem[], searchTerm: string): TOCItem[] {
  const results: TOCItem[] = [];
  const term = searchTerm.toLowerCase();

  function searchRecursive(items: TOCItem[]): void {
    for (const item of items) {
      if (item.title.toLowerCase().includes(term)) {
        results.push(item);
      }
      if (item.children) {
        searchRecursive(item.children);
      }
    }
  }

  searchRecursive(items);
  return results;
}

// React Hook 集成
import React from 'react';

export function useTOCGenerator() {
  const [toc, setToc] = React.useState<TOCResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const generate = React.useCallback(async (markdown: string) => {
    setIsLoading(true);
    try {
      const result = generateTOCOptimized(markdown);
      setToc(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = React.useCallback((searchTerm: string) => {
    if (!toc) return [];
    return searchTOC(toc.items, searchTerm);
  }, [toc]);

  return {
    toc,
    isLoading,
    generate,
    search,
    flattenItems: toc ? flattenTOC(toc.items) : []
  };
}

// 缓存版本的目录生成器
export class CachedTOCGenerator {
  private cache = new Map<string, { result: TOCResult; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize: number = 30) {
    this.maxSize = maxSize;
  }

  generateWithCache(markdown: string): TOCResult {
    const cacheKey = this.hashString(markdown);
    const cached = this.cache.get(cacheKey);

    // 5分钟缓存
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.result;
    }

    const result = generateTOCOptimized(markdown);

    // 管理缓存大小
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

// 性能监控版本
export function generateTOCWithMetrics(markdown: string): {
  result: TOCResult;
  metrics: {
    processingTime: number;
    memoryUsed: number;
  };
} {
  const start = performance.now();
  // @ts-ignore - performance.memory is non-standard but available in Chrome
  const memoryStart = performance.memory?.usedJSHeapSize || 0;

  const result = generateTOCOptimized(markdown);
  
  const processingTime = performance.now() - start;
  // @ts-ignore
  const memoryUsed = (performance.memory?.usedJSHeapSize || 0) - memoryStart;

  return {
    result,
    metrics: {
      processingTime,
      memoryUsed
    }
  };
}
