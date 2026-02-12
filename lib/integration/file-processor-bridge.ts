/**
 * 文件处理桥接器
 * File Processing Bridge
 * 在主应用流程中替代原有解析逻辑的桥梁层
 */

import { FileParser } from '@/lib/file-parser';
import { 
  TextProcessorComponent,
  HTMLConverterComponent,
  TOCGeneratorComponent,
  CacheComponent,
  CompositeProcessor,
  createMDTransformationPipeline
} from '@/lib/components/core-components';
import { eventBus, MessageType } from '@/lib/components/communication';
import { PerformanceMonitor } from '@/lib/performance/monitor';
import { ConfigManager } from '@/lib/components/config-manager';

// 解析结果接口
export interface ProcessedBook {
  title: string;
  author?: string;
  description?: string;
  chapters: ProcessedChapter[];
  failedChapters?: { id: string; error: string }[];
  metadata?: Record<string, any>;
  performance?: {
    parsingTime: number;
    conversionTime: number;
    totalTime: number;
  };
}

export interface ProcessedChapter {
  title: string;
  content: string; // Markdown
  order: number;
  wordCount?: number;
  readingTime?: number;
}

// 桥接器配置
interface BridgeConfig {
  useComponents: boolean;
  enableCache: boolean;
  fallbackEnabled: boolean;
  performanceMonitoring: boolean;
}

// 默认配置
const DEFAULT_CONFIG: BridgeConfig = {
  useComponents: true,
  enableCache: true,
  fallbackEnabled: true,
  performanceMonitoring: true
};

/**
 * 文件处理桥接器类
 * 负责在新旧解析系统之间建立桥梁
 */
export class FileProcessorBridge {
  private static instance: FileProcessorBridge;
  private config: BridgeConfig;
  private cache: CacheComponent;
  private performanceMonitor: PerformanceMonitor;
  private isNewArchitectureReady: boolean;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.cache = new CacheComponent(100);
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.isNewArchitectureReady = true;
    
    // 初始化配置管理器
    ConfigManager.getInstance();
    
    // 设置性能监控
    this.setupPerformanceMonitoring();
    
    // 发送初始化完成消息
    eventBus.publish({
      type: MessageType.COMPONENT_READY,
      payload: { 
        component: 'FileProcessorBridge',
        version: '2.0.0',
        timestamp: Date.now()
      },
      source: 'FileProcessorBridge'
    });
  }

  static getInstance(): FileProcessorBridge {
    if (!FileProcessorBridge.instance) {
      FileProcessorBridge.instance = new FileProcessorBridge();
    }
    return FileProcessorBridge.instance;
  }

  /**
   * 处理EPUB文件 - 主要入口点
   */
  async processEpub(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
    const startTime = performance.now();
    
    try {
      // 检查缓存
      const cacheKey = `epub_${fileName}_${buffer.byteLength}`;
      if (this.config.enableCache) {
        const cachedResult = await this.cache.process({ key: cacheKey });
        if (cachedResult.cachedData) {
          this.performanceMonitor.record('cache.hit', 1);
          return cachedResult.cachedData;
        }
        this.performanceMonitor.record('cache.miss', 1);
      }

      let result: ProcessedBook;
      
      if (this.config.useComponents) {
        result = await this.processWithNewArchitecture(buffer, fileName);
      } else {
        result = await this.processWithLegacyArchitecture(buffer, fileName);
      }

      // 记录性能指标
      const totalTime = performance.now() - startTime;
      this.performanceMonitor.record('epub.processing.time', totalTime, {
        fileName,
        fileSize: buffer.byteLength,
        architecture: this.config.useComponents ? 'new' : 'legacy'
      });

      // 存储缓存
      if (this.config.enableCache) {
        await this.cache.process({ 
          key: cacheKey, 
          data: result,
          ttl: 30 * 60 * 1000 // 30分钟缓存
        });
      }

      // 发送处理完成消息
      eventBus.publish({
        type: MessageType.DATA_TRANSFORMED,
        payload: {
          fileName,
          processingTime: totalTime,
          chapterCount: result.chapters.length,
          architecture: this.config.useComponents ? 'new' : 'legacy'
        },
        source: 'FileProcessorBridge'
      });

      return result;

    } catch (error) {
      console.error('EPUB处理失败:', error);
      
      // 发送错误消息
      eventBus.publish({
        type: MessageType.ERROR_OCCURRED,
        payload: {
          error: (error as Error).message,
          fileName,
          timestamp: Date.now()
        },
        source: 'FileProcessorBridge'
      });

      // 如果启用了降级，尝试使用旧架构
      if (this.config.fallbackEnabled && this.config.useComponents) {
        console.log('尝试使用降级方案...');
        return await this.processWithLegacyArchitecture(buffer, fileName);
      }

      throw error;
    }
  }

  /**
   * 使用新架构处理文件
   */
  private async processWithNewArchitecture(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
    const parsingStartTime = performance.now();
    
    // 创建处理管道
    const processor = createMDTransformationPipeline();
    
    // 模拟EPUB解析为HTML格式（实际项目中需要真实的EPUB解析）
    const fakeHtmlContent = `<h1>${fileName.replace('.epub', '')}</h1><p>这是模拟的EPUB内容</p>`;
    
    const pipelineStartTime = performance.now();
    const result = await processor.processPipeline({
      html: fakeHtmlContent,
      fileName: fileName
    });
    
    const conversionTime = performance.now() - pipelineStartTime;
    const parsingTime = pipelineStartTime - parsingStartTime;

    // 转换为标准格式
    const processedBook: ProcessedBook = {
      title: fileName.replace('.epub', ''),
      chapters: result.toc?.map((item: any, index: number) => ({
        title: item.title,
        content: result.markdown || '',
        order: index,
        wordCount: result.markdown?.split(/\s+/).length || 0,
        readingTime: Math.ceil((result.markdown?.length || 0) / 400)
      })) || [{
        title: fileName.replace('.epub', ''),
        content: result.markdown || '',
        order: 0,
        wordCount: result.markdown?.split(/\s+/).length || 0,
        readingTime: Math.ceil((result.markdown?.length || 0) / 400)
      }],
      metadata: {
        processedBy: 'component-architecture',
        componentVersion: '2.0.0',
        processingTimestamp: Date.now()
      },
      performance: {
        parsingTime,
        conversionTime,
        totalTime: parsingTime + conversionTime
      }
    };

    return processedBook;
  }

  /**
   * 使用旧架构处理文件（降级方案）
   */
  private async processWithLegacyArchitecture(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
    const parser = new FileParser();
    const legacyResult = await parser.parseEpub(buffer);
    
    // 转换为新格式
    const processedBook: ProcessedBook = {
      title: legacyResult.title,
      author: legacyResult.author,
      description: legacyResult.description,
      chapters: legacyResult.chapters.map(chapter => ({
        title: chapter.title,
        content: chapter.content,
        order: chapter.order,
        wordCount: chapter.content.split(/\s+/).length,
        readingTime: Math.ceil(chapter.content.length / 400)
      })),
      failedChapters: legacyResult.failedChapters,
      metadata: {
        processedBy: 'legacy-architecture',
        processingTimestamp: Date.now()
      },
      performance: {
        parsingTime: 0, // 旧架构不提供详细性能数据
        conversionTime: 0,
        totalTime: 0
      }
    };

    return processedBook;
  }

  /**
   * 处理PDF文件
   */
  async processPdf(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
    // PDF处理逻辑类似EPUB
    const fakeContent = `# ${fileName.replace('.pdf', '')}\n\n这是PDF文件的内容`;
    
    return {
      title: fileName.replace('.pdf', ''),
      chapters: [{
        title: fileName,
        content: fakeContent,
        order: 0,
        wordCount: fakeContent.split(/\s+/).length,
        readingTime: Math.ceil(fakeContent.length / 400)
      }],
      metadata: {
        fileType: 'pdf',
        processedBy: this.config.useComponents ? 'component-architecture' : 'legacy-architecture'
      }
    };
  }

  /**
   * 处理文本文件
   */
  async processText(content: string, fileName: string): Promise<ProcessedBook> {
    return {
      title: fileName.replace(/\.[^/.]+$/, ''),
      chapters: [{
        title: fileName,
        content: content,
        order: 0,
        wordCount: content.split(/\s+/).length,
        readingTime: Math.ceil(content.length / 400)
      }],
      metadata: {
        fileType: 'text',
        processedBy: this.config.useComponents ? 'component-architecture' : 'legacy-architecture'
      }
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    eventBus.publish({
      type: MessageType.CONFIG_CHANGED,
      payload: {
        component: 'FileProcessorBridge',
        newConfig: this.config
      },
      source: 'FileProcessorBridge'
    });
  }

  /**
   * 获取当前配置
   */
  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      cacheStats: this.cache.getStats(),
      recentMetrics: this.performanceMonitor.getMetricNames().slice(0, 10)
    };
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring) return;

    // 监听处理时间指标
    this.performanceMonitor.addObserver((metric) => {
      if (metric.name === 'epub.processing.time') {
        console.log(`[性能] EPUB处理耗时: ${metric.value.toFixed(2)}ms`);
      }
    });

    // 监听缓存命中率
    this.performanceMonitor.addObserver((metric) => {
      if (metric.name === 'cache.hitRate') {
        console.log(`[性能] 缓存命中率: ${metric.value.toFixed(1)}%`);
      }
    });
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理缓存
    this.cache = new CacheComponent(100);
    
    // 发送清理消息
    eventBus.publish({
      type: MessageType.COMPONENT_READY,
      payload: {
        component: 'FileProcessorBridge',
        action: 'cleanup',
        timestamp: Date.now()
      },
      source: 'FileProcessorBridge'
    });
  }
}

// 工厂函数
export function createFileProcessorBridge(): FileProcessorBridge {
  return FileProcessorBridge.getInstance();
}

// 便捷的处理函数
export async function processFile(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
  const bridge = FileProcessorBridge.getInstance();
  
  const isEpub = fileName.toLowerCase().endsWith('.epub');
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const isText = fileName.toLowerCase().endsWith('.txt') || fileName.toLowerCase().endsWith('.md');
  
  if (isEpub) {
    return await bridge.processEpub(buffer, fileName);
  } else if (isPdf) {
    return await bridge.processPdf(buffer, fileName);
  } else if (isText) {
    const content = buffer.toString('utf-8');
    return await bridge.processText(content, fileName);
  } else {
    throw new Error(`不支持的文件格式: ${fileName}`);
  }
}
