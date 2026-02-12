/**
 * Migration Manager Core
 * 核心迁移管理逻辑
 */

// 迁移配置
export interface MigrationConfig {
  useNewVersion: boolean;
  fallbackEnabled: boolean;
  logEnabled: boolean;
  performanceThreshold: number;
}

// 性能监控数据
export interface PerformanceData {
  operation: string;
  duration: number;
  success: boolean;
  usedFallback: boolean;
  timestamp: number;
}

// 迁移管理器核心类
export class MigrationManager {
  private config: MigrationConfig;
  private performanceLog: PerformanceData[] = [];
  private cache = new Map<string, any>();

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      useNewVersion: true,
      fallbackEnabled: true,
      logEnabled: true,
      performanceThreshold: 1000,
      ...config
    };
  }

  // 执行迁移操作
  async execute<T>(
    operationName: string,
    newImplementation: () => Promise<T>,
    fallbackImplementation: () => Promise<T>,
    input: any
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      let result: T;
      
      if (this.config.useNewVersion) {
        try {
          result = await newImplementation();
          const duration = performance.now() - startTime;
          
          this.logPerformance(operationName, duration, true, false);
          
          // 性能检查
          if (duration > this.config.performanceThreshold && this.config.fallbackEnabled) {
            if (this.config.logEnabled) {
              console.warn(`⚠️ ${operationName} 性能超标 (${duration}ms)，尝试回退`);
            }
            result = await fallbackImplementation();
            this.logPerformance(operationName, performance.now() - startTime, true, true);
          }
        } catch (error) {
          if (this.config.logEnabled) {
            console.warn(`⚠️ 新版本 ${operationName} 失败，回退到旧版本:`, error);
          }
          
          if (this.config.fallbackEnabled) {
            result = await fallbackImplementation();
            this.logPerformance(operationName, performance.now() - startTime, true, true);
          } else {
            throw error;
          }
        }
      } else {
        result = await fallbackImplementation();
        this.logPerformance(operationName, performance.now() - startTime, false, false);
      }
      
      return result;
      
    } catch (error) {
      if (this.config.logEnabled) {
        console.error(`💥 ${operationName} 执行失败:`, error);
      }
      throw error;
    }
  }

  // 记录性能数据
  private logPerformance(
    operation: string, 
    duration: number, 
    isNewVersion: boolean, 
    usedFallback: boolean
  ) {
    const logEntry: PerformanceData = {
      operation,
      duration,
      success: true,
      usedFallback,
      timestamp: Date.now()
    };
    
    this.performanceLog.push(logEntry);
    
    // 保持日志在合理范围内
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-500);
    }
    
    if (this.config.logEnabled) {
      console.log(`📊 ${operation}: ${duration.toFixed(2)}ms ${isNewVersion ? '(新)' : '(旧)'} ${usedFallback ? '[回退]' : ''}`);
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<MigrationConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.config.logEnabled) {
      console.log('⚙️ 迁移配置更新:', newConfig);
    }
  }

  // 获取性能统计
  getPerformanceStats() {
    const recentLogs = this.performanceLog.slice(-100);
    if (recentLogs.length === 0) return null;
    
    const avgDuration = recentLogs.reduce((sum, log) => sum + log.duration, 0) / recentLogs.length;
    const successRate = (recentLogs.filter(log => log.success).length / recentLogs.length) * 100;
    const fallbackCount = recentLogs.filter(log => log.usedFallback).length;
    
    return {
      averageDuration: avgDuration,
      successRate,
      fallbackCount,
      totalOperations: recentLogs.length
    };
  }

  // 缓存管理
  setCache<T>(key: string, value: T, ttl: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }
}

// 全局实例
export const migrationManager = new MigrationManager({
  useNewVersion: true,
  fallbackEnabled: true,
  logEnabled: true,
  performanceThreshold: 1000
});

// 兼容层服务
export class CompatibleService {
  async transformHTML(html: string, config?: any) {
    const cacheKey = `transform_${html.length}`;
    const cached = migrationManager.getCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    return migrationManager.execute(
      'html_transform',
      async () => {
        // 这里调用新的转换函数
        // 暂时返回模拟数据
        return {
          content: html.replace(/<[^>]*>/g, ''),
          stats: { wordCount: html.split(/\s+/).length, processingTime: 10 }
        };
      },
      async () => {
        // 这里调用旧的 FileParser
        throw new Error('旧系统暂未实现');
      },
      { html, config }
    );
  }

  async extractSiteContent(url: string, html: string) {
    const cacheKey = `extract_${url}`;
    const cached = migrationManager.getCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    return migrationManager.execute(
      'site_extraction',
      async () => {
        // 这里调用新的站点适配器
        return { content: html, title: 'Extracted Content' };
      },
      async () => {
        // 这里调用旧的 site-adapters
        throw new Error('旧系统暂未实现');
      },
      { url, html }
    );
  }

  async generateTOC(markdown: string) {
    const cacheKey = `toc_${markdown.length}`;
    const cached = migrationManager.getCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    return migrationManager.execute(
      'toc_generation',
      async () => {
        // 这里调用新的 TOC 生成器
        return { items: [], metadata: { totalItems: 0, maxDepth: 0, estimatedReadingTime: 0 } };
      },
      async () => {
        // 这里调用旧的 toc-generator
        throw new Error('旧系统暂未实现');
      },
      { markdown }
    );
  }
}

// 工具函数
export function createMigrationHook() {
  const service = new CompatibleService();
  
  return {
    transform: service.transformHTML.bind(service),
    extract: service.extractSiteContent.bind(service),
    generateTOC: service.generateTOC.bind(service),
    getStats: migrationManager.getPerformanceStats.bind(migrationManager)
  };
}

// 配置管理
export class MigrationConfigManager {
  static getConfig() {
    return {
      useNewVersion: process.env.NEXT_PUBLIC_USE_NEW_MD_TRANSFORM === 'true',
      fallbackEnabled: process.env.NEXT_PUBLIC_FALLBACK_ENABLED !== 'false',
      logEnabled: process.env.NODE_ENV === 'development',
      performanceThreshold: parseInt(process.env.NEXT_PUBLIC_PERFORMANCE_THRESHOLD || '1000')
    };
  }
  
  static updateRuntimeConfig(newConfig: Partial<MigrationConfig>) {
    migrationManager.updateConfig(newConfig);
  }
}
