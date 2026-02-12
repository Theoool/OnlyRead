/**
 * Migration Wrapper for TOC Generator
 * TOC 生成器迁移包装器
 */

import { generateTOCOptimized, TOCResult } from '../optimized/toc-generator';
import { migrationManager } from '../migration/core';

// 原始接口保持兼容
interface LegacyTOCItem {
  id: string;
  title: string;
  level: number;
  children?: LegacyTOCItem[];
  startPosition: number;
  headingIndex: number;
}

interface LegacyTOCWithMetadata {
  items: LegacyTOCItem[];
  totalHeadings: number;
  maxLevel: number;
  estimatedReadTime: number;
}

// 新旧接口转换
function convertToLegacyFormat(result: TOCResult): LegacyTOCWithMetadata {
  function convertItems(items: any[]): LegacyTOCItem[] {
    return items.map((item, index) => ({
      id: item.id,
      title: item.title,
      level: item.level,
      children: item.children ? convertItems(item.children) : undefined,
      startPosition: item.position || 0,
      headingIndex: item.index || index
    }));
  }

  return {
    items: convertItems(result.items),
    totalHeadings: result.metadata.totalItems,
    maxLevel: result.metadata.maxDepth,
    estimatedReadTime: result.metadata.estimatedReadingTime
  };
}

// 渐进式替换的 TOC 生成器
export class ProgressiveTOCGenerator {
  private useNewVersion: boolean;
  private fallbackToOld: boolean;

  constructor(useNew: boolean = true, fallback: boolean = true) {
    this.useNewVersion = useNew;
    this.fallbackToOld = fallback;
  }

  // 主要入口方法 - 保持与原接口完全兼容
  generateTOC(markdown: string): LegacyTOCWithMetadata {
    // 检查缓存
    const cacheKey = `toc_${markdown.length}_${markdown.substring(0, 100)}`;
    const cached = migrationManager.getCache<LegacyTOCWithMetadata>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      if (this.useNewVersion) {
        // 使用新版本
        const result = generateTOCOptimized(markdown);
        const legacyResult = convertToLegacyFormat(result);
        
        // 缓存结果
        migrationManager.setCache(cacheKey, legacyResult);
        
        return legacyResult;
      } else {
        // 回退到旧版本（这里应该是原始实现）
        return this.legacyGenerateTOC(markdown);
      }
    } catch (error) {
      console.warn('新版本 TOC 生成失败，回退到旧版本:', error);
      
      if (this.fallbackToOld) {
        return this.legacyGenerateTOC(markdown);
      }
      
      throw error;
    }
  }

  // 模拟旧版本实现
  private legacyGenerateTOC(markdown: string): LegacyTOCWithMetadata {
    // 这里应该包含原始 toc-generator.ts 的实现
    // 为了演示，返回一个基本结果
    const lines = markdown.split('\n');
    const items: LegacyTOCItem[] = [];
    let headingIndex = 0;
    let maxLevel = 1;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        const id = `heading-${headingIndex}`;

        items.push({
          id,
          title,
          level,
          startPosition: 0,
          headingIndex: headingIndex++
        });

        if (level > maxLevel) maxLevel = level;
      }
    }

    // 估算阅读时间
    const wordCount = markdown.split(/\s+/).length;
    const estimatedReadTime = Math.ceil(wordCount / 200);

    return {
      items,
      totalHeadings: headingIndex,
      maxLevel,
      estimatedReadTime
    };
  }

  // 新版本专用方法
  generateTOCOptimizedNew(markdown: string): TOCResult {
    return generateTOCOptimized(markdown);
  }

  // 配置方法
  setUseNewVersion(useNew: boolean) {
    this.useNewVersion = useNew;
  }

  setFallbackEnabled(fallback: boolean) {
    this.fallbackToOld = fallback;
  }

  // 性能测试方法
  async benchmark(markdown: string, iterations: number = 100): Promise<{
    newVersion: { avgTime: number; successRate: number };
    oldVersion: { avgTime: number; successRate: number };
  }> {
    const results = {
      newVersion: { times: [] as number[], successes: 0 },
      oldVersion: { times: [] as number[], successes: 0 }
    };

    // 测试新版本
    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        this.generateTOCOptimizedNew(markdown);
        const end = performance.now();
        results.newVersion.times.push(end - start);
        results.newVersion.successes++;
      } catch (error) {
        console.error('新版本测试失败:', error);
      }
    }

    // 测试旧版本
    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        this.legacyGenerateTOC(markdown);
        const end = performance.now();
        results.oldVersion.times.push(end - start);
        results.oldVersion.successes++;
      } catch (error) {
        console.error('旧版本测试失败:', error);
      }
    }

    return {
      newVersion: {
        avgTime: results.newVersion.times.reduce((a, b) => a + b, 0) / results.newVersion.times.length,
        successRate: (results.newVersion.successes / iterations) * 100
      },
      oldVersion: {
        avgTime: results.oldVersion.times.reduce((a, b) => a + b, 0) / results.oldVersion.times.length,
        successRate: (results.oldVersion.successes / iterations) * 100
      }
    };
  }
}

// 工厂函数
export function createTOCGenerator(
  useNewVersion: boolean = true,
  fallbackEnabled: boolean = true
): ProgressiveTOCGenerator {
  return new ProgressiveTOCGenerator(useNewVersion, fallbackEnabled);
}

// 默认实例
export const tocGenerator = createTOCGenerator(true, true);

// 便捷方法 - 直接替换现有调用
export function generateTOC(markdown: string): LegacyTOCWithMetadata {
  return tocGenerator.generateTOC(markdown);
}

// React Hook 集成
import React from 'react';

export function useTOCMigration() {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [benchmarkResults, setBenchmarkResults] = React.useState<any>(null);

  const generate = React.useCallback(async (markdown: string) => {
    setIsGenerating(true);
    try {
      return tocGenerator.generateTOC(markdown);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const runBenchmark = React.useCallback(async (markdown: string) => {
    setIsGenerating(true);
    try {
      const results = await tocGenerator.benchmark(markdown, 50);
      setBenchmarkResults(results);
      return results;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const toggleVersion = React.useCallback((useNew: boolean) => {
    tocGenerator.setUseNewVersion(useNew);
  }, []);

  return {
    generate,
    runBenchmark,
    toggleVersion,
    isGenerating,
    benchmarkResults
  };
}

// 配置管理
export class TOCMigrationConfig {
  static enableNewVersion() {
    tocGenerator.setUseNewVersion(true);
  }

  static disableNewVersion() {
    tocGenerator.setUseNewVersion(false);
  }

  static enableFallback() {
    tocGenerator.setFallbackEnabled(true);
  }

  static disableFallback() {
    tocGenerator.setFallbackEnabled(false);
  }

  static getCurrentConfig() {
    return {
      useNewVersion: (tocGenerator as any).useNewVersion,
      fallbackEnabled: (tocGenerator as any).fallbackToOld
    };
  }
}
