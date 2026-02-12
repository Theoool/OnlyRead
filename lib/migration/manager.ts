/**
 * Migration Manager for MD Transformation System
 * 渐进式迁移控制器
 */

import { TransformConfig, TransformResult, htmlToMarkdown } from '../optimized/md-transformer';
import { splitMarkdownBlocksOptimized } from '../optimized/text-processing';
import { selectAdapter, CachedSiteAdapter } from '../optimized/site-adapters';
import { generateTOCOptimized } from '../optimized/toc-generator';

// 迁移配置
export interface MigrationConfig {
  useNewVersion: boolean;
  fallbackToOld: boolean;
  logMigration: boolean;
  performanceThreshold: number; // ms
}

// 原始系统接口（模拟现有系统）
interface LegacySystem {
  transform: (input: any) => Promise<any>;
  extract: (html: string, url: string) => any;
  generateTOC: (markdown: string) => any;
}

// 迁移状态管理
class MigrationManager {
  private config: MigrationConfig;
  private legacySystem: LegacySystem | null = null;
  private newSystemInitialized = false;
  private performanceBaseline: Map<string, number> = new Map();

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      useNewVersion: true,
      fallbackToOld: true,
      logMigration: true,
      performanceThreshold: 1000,
      ...config
    };
  }

  // 初始化新系统
  async initializeNewSystem() {
    if (this.newSystemInitialized) return;
    
    try {
      // 预热新系统组件
      await this.warmUpComponents();
      this.newSystemInitialized = true;
      
      if (this.config.logMigration) {
        console.log('🚀 新系统初始化完成');
      }
    } catch (error) {
      console.error('❌ 新系统初始化失败:', error);
      this.config.useNewVersion = false;
    }
  }

  private async warmUpComponents() {
    // 预热关键组件
    const warmupTasks = [
      htmlToMarkdown('<div>test</div>'),
      splitMarkdownBlocksOptimized('# Test\n\nContent'),
      generateTOCOptimized('# Test\n\n## Subsection'),
    ];
    
    await Promise.all(warmupTasks);
  }

  // 智能路由决策
  async routeRequest<T>(
    operation: string,
    newImpl: () => Promise<T>,
    legacyImpl: () => Promise<T>,
    inputData: any
  ): Promise<T> {
    // 记录开始时间
    const startTime = performance.now();
    
    try {
      let result: T;
      
      if (this.config.useNewVersion) {
        try {
          result = await newImpl();
          
          // 性能监控
          const duration = performance.now() - startTime;
          this.recordPerformance(operation, duration, inputData);
          
          // 如果性能不达标且允许回退
          if (duration > this.config.performanceThreshold && this.config.fallbackToOld) {
            if (this.config.logMigration) {
              console.warn(`⚠️ ${operation} 性能未达标 (${duration}ms)，尝试回退到旧版本`);
            }
            result = await legacyImpl();
          }
        } catch (newError) {
          if (this.config.logMigration) {
            console.warn(`⚠️ 新版本 ${operation} 失败，回退到旧版本:`, newError);
          }
          
          if (this.config.fallbackToOld) {
            result = await legacyImpl();
          } else {
            throw newError;
          }
        }
      } else {
        result = await legacyImpl();
      }
      
      return result;
      
    } catch (error) {
      if (this.config.logMigration) {
        console.error(`💥 ${operation} 执行失败:`, error);
      }
      throw error;
    }
  }

  private recordPerformance(operation: string, duration: number, inputData: any) {
    if (this.config.logMigration) {
      console.log(`📊 ${operation}: ${duration.toFixed(2)}ms`);
    }
    
    // 记录性能基线
    const inputSize = JSON.stringify(inputData).length;
    const baselineKey = `${operation}_${Math.floor(inputSize / 1000)}k`;
    
    const existing = this.performanceBaseline.get(baselineKey) || Infinity;
    if (duration < existing) {
      this.performanceBaseline.set(baselineKey, duration);
    }
  }

  // 获取性能报告
  getPerformanceReport() {
    return {
      baselines: Object.fromEntries(this.performanceBaseline),
      config: this.config,
      initialized: this.newSystemInitialized
    };
  }

  // 动态配置更新
  updateConfig(newConfig: Partial<MigrationConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.logMigration) {
      console.log('⚙️ 迁移配置更新:', newConfig);
    }
  }

  // 特性开关控制
  setFeature(feature: 'transformer' | 'textProcessor' | 'siteAdapter' | 'tocGenerator', enabled: boolean) {
    // 这里可以实现更细粒度的控制
    if (this.config.logMigration) {
      console.log(`🔧 ${feature} 功能设置为: ${enabled ? '启用' : '禁用'}`);
    }
  }
}

// 全局迁移管理器实例
export const migrationManager = new MigrationManager({
  useNewVersion: true,
  fallbackToOld: true,
  logMigration: true,
  performanceThreshold: 1000
});

// 包装现有系统的兼容层
export class CompatibleTransformationService {
  private cachedAdapter = new CachedSiteAdapter();

  async transformContent(input: {
    html: string;
    url?: string;
    config?: TransformConfig;
  }): Promise<TransformResult> {
    return migrationManager.routeRequest(
      'content_transform',
      () => htmlToMarkdown(input.html, input.config),
      () => this.legacyTransform(input),
      input
    );
  }

  private async legacyTransform(input: any): Promise<TransformResult> {
    // 模拟调用旧系统
    // 实际实现中这里会调用现有的 FileParser、ContentExtractor 等
    throw new Error('Legacy system not implemented');
  }

  async extractSiteContent(url: string, html: string) {
    return migrationManager.routeRequest(
      'site_extraction',
      async () => {
        const adapter = selectAdapter(url);
        if (adapter) {
          const result = adapter.extract(html);
          return { content: result.content, title: result.title };
        }
        return { content: '', title: '' };
      },
      () =>  this.legacyExtract(url, html),
      { url, html }
    );
  }

  private async legacyExtract(url: string, html: string): Promise<{ content: string; title: string }> {
    // 模拟调用旧系统
    throw new Error('Legacy extraction not implemented');
  }

  async generateTableOfContents(markdown: string) {
    return migrationManager.routeRequest(
      'toc_generation',
      () => Promise.resolve(generateTOCOptimized(markdown)),
      () => this.legacyGenerateTOC(markdown),
      { markdown }
    );
  }

  private async legacyGenerateTOC(markdown: string): Promise<{ items: any[]; metadata: { totalItems: number; maxDepth: number; estimatedReadingTime: number } }> {
    // 模拟调用旧系统
    throw new Error('Legacy TOC generation not implemented');
  }

  // 批量处理接口
  async batchTransform(inputs: Array<{ html: string; url?: string }>) {
    const results = await Promise.all(
      inputs.map(input => this.transformContent(input))
    );
    return results;
  }

  // 获取系统状态
  getSystemStatus() {
    return {
      migration: migrationManager.getPerformanceReport(),
      cacheSize: this.cachedAdapter.getCacheSize()
    };
  }
}

// React Hook 集成
import React from 'react';

export function useMigrationAwareTransformer() {
  const [isMigrating, setIsMigrating] = React.useState(false);
  const service = React.useMemo(() => new CompatibleTransformationService(), []);

  const transform = React.useCallback(async (input: any) => {
    setIsMigrating(true);
    try {
      return await service.transformContent(input);
    } finally {
      setIsMigrating(false);
    }
  }, [service]);

  const getStatus = React.useCallback(() => service.getSystemStatus(), [service]);

  return {
    transform,
    isMigrating,
    getStatus,
    service
  };
}

// 迁移监控仪表板数据
export interface MigrationMetrics {
  successRate: number;
  averagePerformance: number;
  fallbackCount: number;
  errorCount: number;
  cacheHitRate: number;
}

export class MigrationMonitor {
  private metrics: MigrationMetrics = {
    successRate: 100,
    averagePerformance: 0,
    fallbackCount: 0,
    errorCount: 0,
    cacheHitRate: 0
  };

  private operationLog: Array<{
    operation: string;
    success: boolean;
    duration: number;
    usedFallback: boolean;
    timestamp: number;
  }> = [];

  logOperation(operation: string, success: boolean, duration: number, usedFallback: boolean) {
    this.operationLog.push({
      operation,
      success,
      duration,
      usedFallback,
      timestamp: Date.now()
    });

    // 更新指标
    this.updateMetrics();
    
    // 保持日志在合理范围内
    if (this.operationLog.length > 1000) {
      this.operationLog = this.operationLog.slice(-500);
    }
  }

  private updateMetrics() {
    const recentOps = this.operationLog.slice(-100);
    if (recentOps.length === 0) return;

    this.metrics.successRate = (recentOps.filter(op => op.success).length / recentOps.length) * 100;
    this.metrics.averagePerformance = recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length;
    this.metrics.fallbackCount = recentOps.filter(op => op.usedFallback).length;
    this.metrics.errorCount = recentOps.filter(op => !op.success).length;
  }

  getMetrics(): MigrationMetrics {
    return { ...this.metrics };
  }

  getRecentOperations(limit: number = 50) {
    return this.operationLog.slice(-limit);
  }
}

// 全局监控实例
export const migrationMonitor = new MigrationMonitor();
