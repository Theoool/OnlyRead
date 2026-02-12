/**
 * Component-based Architecture for MD Transformation
 * 基于组件的架构设计
 */

// 核心转换组件接口
export interface TransformComponent {
  name: string;
  version: string;
  process(input: any): Promise<any>;
  validate(input: any): boolean;
}

// 文本处理器组件
export class TextProcessorComponent implements TransformComponent {
  name = 'TextProcessor';
  version = '2.0.0';
  
  async process(input: { text: string }): Promise<{ processedText: string; stats: any }> {
    // 文本清理和优化
    const cleaned = input.text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return {
      processedText: cleaned,
      stats: {
        originalLength: input.text.length,
        cleanedLength: cleaned.length,
        reduction: ((input.text.length - cleaned.length) / input.text.length * 100).toFixed(1)
      }
    };
  }
  
  validate(input: any): boolean {
    return typeof input?.text === 'string' && input.text.length > 0;
  }
}

// HTML 转换组件
export class HTMLConverterComponent implements TransformComponent {
  name = 'HTMLConverter';
  version = '2.0.0';
  
  async process(input: { html: string }): Promise<{ markdown: string; images: string[] }> {
    // 简化的 HTML 到 Markdown 转换
    const markdown = input.html
      .replace(/<[^>]*>/g, '') // 移除标签
      .replace(/\s+/g, ' ')
      .trim();
    
    const images = input.html.match(/<img[^>]*src="([^"]*)"[^>]*>/gi) || [];
    
    return {
      markdown,
      images: images.map(img => img.match(/src="([^"]*)"/)?.[1] || '')
    };
  }
  
  validate(input: any): boolean {
    return typeof input?.html === 'string' && input.html.length > 0;
  }
}

// 目录生成组件
export class TOCGeneratorComponent implements TransformComponent {
  name = 'TOCGenerator';
  version = '2.0.0';
  
  async process(input: { markdown: string }): Promise<{ toc: any[]; metadata: any }> {
    const lines = input.markdown.split('\n');
    const tocItems: any[] = [];
    let itemCount = 0;
    
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        tocItems.push({
          id: `item-${itemCount++}`,
          level: match[1].length,
          title: match[2].trim()
        });
      }
    }
    
    return {
      toc: tocItems,
      metadata: {
        totalItems: itemCount,
        maxDepth: Math.max(...tocItems.map(item => item.level), 1)
      }
    };
  }
  
  validate(input: any): boolean {
    return typeof input?.markdown === 'string' && input.markdown.length > 0;
  }
}

// 缓存组件
export class CacheComponent implements TransformComponent {
  name = 'CacheManager';
  version = '2.0.0';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  async process(input: { key: string; data?: any; ttl?: number }): Promise<{ cachedData?: any; stored: boolean }> {
    const { key, data, ttl = 5 * 60 * 1000 } = input;
    
    // 获取缓存
    if (!data) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return { cachedData: cached.data, stored: false };
      }
      return { stored: false };
    }
    
    // 存储缓存
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return { stored: true };
  }
  
  validate(input: any): boolean {
    return typeof input?.key === 'string' && input.key.length > 0;
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// 组合处理器
export class CompositeProcessor {
  private components: TransformComponent[] = [];
  
  addComponent(component: TransformComponent): this {
    this.components.push(component);
    return this;
  }
  
  async processPipeline(initialInput: any): Promise<any> {
    let currentData = initialInput;
    
    for (const component of this.components) {
      if (component.validate(currentData)) {
        try {
          currentData = await component.process(currentData);
        } catch (error) {
          console.warn(`组件 ${component.name} 处理失败:`, error);
          // 继续处理下一个组件
        }
      }
    }
    
    return currentData;
  }
  
  getComponentStats() {
    return this.components.map(comp => ({
      name: comp.name,
      version: comp.version
    }));
  }
}

// 工厂函数
export function createMDTransformationPipeline() {
  const processor = new CompositeProcessor();
  
  return processor
    .addComponent(new CacheComponent())
    .addComponent(new TextProcessorComponent())
    .addComponent(new HTMLConverterComponent())
    .addComponent(new TOCGeneratorComponent());
}

// React 集成 Hook
import React from 'react';

export function useComponentBasedTransformer() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [pipeline] = React.useState(() => createMDTransformationPipeline());
  
  const transform = React.useCallback(async (input: { html: string }) => {
    setIsProcessing(true);
    try {
      return await pipeline.processPipeline(input);
    } finally {
      setIsProcessing(false);
    }
  }, [pipeline]);
  
  const getStats = React.useCallback(() => ({
    components: pipeline.getComponentStats(),
    isProcessing
  }), [pipeline, isProcessing]);
  
  return {
    transform,
    getStats,
    isProcessing
  };
}

// 配置管理组件
export class ConfigManager {
  static getConfig() {
    return {
      useComponents: process.env.NEXT_PUBLIC_USE_COMPONENT_ARCH === 'true',
      cacheEnabled: process.env.NEXT_PUBLIC_CACHE_ENABLED !== 'false',
      logLevel: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info'
    };
  }
  
  static updateConfig(newConfig: Partial<ReturnType<typeof ConfigManager.getConfig>>) {
    // 在实际应用中，这里会更新运行时配置
    console.log('配置更新:', newConfig);
  }
}
