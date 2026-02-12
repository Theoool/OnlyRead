/**
 * 主应用通信系统集成
 * Main Application Communication System Integration
 */

import { eventBus, MessageType, EventBus } from '@/lib/components/communication';
import { PerformanceMonitor } from '@/lib/performance/monitor';
import { ConfigManager } from '@/lib/components/config-manager';
import { FileProcessorBridge } from '@/lib/integration/file-processor-bridge';

// 应用级事件处理器
class AppEventHandler {
  private static instance: AppEventHandler;
  private performanceMonitor: PerformanceMonitor;
  private configManager: ConfigManager;
  private bridge: FileProcessorBridge;

  private constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.bridge = FileProcessorBridge.getInstance();
    
    this.setupEventHandlers();
    this.initializeSystem();
  }

  static getInstance(): AppEventHandler {
    if (!AppEventHandler.instance) {
      AppEventHandler.instance = new AppEventHandler();
    }
    return AppEventHandler.instance;
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 处理组件准备就绪事件
    eventBus.subscribe(MessageType.COMPONENT_READY, (message) => {
      console.log(`[应用通信] 组件就绪: ${message.payload.component}`, message.payload);
      
      // 记录到性能监控
      this.performanceMonitor.record('component.ready', 1, {
        component: message.payload.component,
        version: message.payload.version
      });
    });

    // 处理数据转换完成事件
    eventBus.subscribe(MessageType.DATA_TRANSFORMED, (message) => {
      console.log(`[应用通信] 数据转换完成: ${message.payload.fileName}`, {
        processingTime: message.payload.processingTime,
        chapterCount: message.payload.chapterCount
      });
      
      // 更新性能指标
      this.performanceMonitor.record('data.transform.time', message.payload.processingTime, {
        fileName: message.payload.fileName,
        architecture: message.payload.architecture
      });
    });

    // 处理配置变更事件
    eventBus.subscribe(MessageType.CONFIG_CHANGED, (message) => {
      console.log(`[应用通信] 配置变更:`, message.payload);
      
      // 如果是桥接器的配置变更，更新桥接器
      if (message.payload.component === 'FileProcessorBridge') {
        this.bridge.updateConfig(message.payload.newConfig);
      }
    });

    // 处理性能更新事件
    eventBus.subscribe(MessageType.PERFORMANCE_UPDATE, (message) => {
      console.log(`[应用通信] 性能更新: ${message.payload.metric}`, {
        value: message.payload.value,
        average: message.payload.average
      });
    });

    // 处理错误事件
    eventBus.subscribe(MessageType.ERROR_OCCURRED, (message) => {
      console.error(`[应用通信] 错误发生:`, message.payload);
      
      // 记录错误到性能监控
      this.performanceMonitor.record('error.count', 1, {
        component: message.payload.component,
        error: message.payload.error
      });
    });
  }

  /**
   * 初始化系统
   */
  private initializeSystem(): void {
    // 发送系统初始化消息
    eventBus.publish({
      type: MessageType.COMPONENT_READY,
      payload: {
        component: 'MainApplication',
        version: '1.0.0',
        timestamp: Date.now()
      },
      source: 'AppEventHandler'
    });

    // 初始化配置
    this.initializeConfiguration();
    
    // 启动性能监控
    this.startPerformanceMonitoring();
  }

  /**
   * 初始化配置
   */
  private initializeConfiguration(): void {
    // 从环境变量加载配置
    const envConfig = {
      useComponents: process.env.NEXT_PUBLIC_USE_COMPONENT_ARCH === 'true',
      enableCache: process.env.NEXT_PUBLIC_CACHE_ENABLED !== 'false',
      fallbackEnabled: process.env.NEXT_PUBLIC_FALLBACK_ENABLED !== 'false',
      performanceMonitoring: process.env.NEXT_PUBLIC_PERFORMANCE_MONITORING !== 'false'
    };

    // 更新桥接器配置
    this.bridge.updateConfig(envConfig);

    // 应用配置到配置管理器
    this.configManager.updateConfig({
      core: {
        useComponents: envConfig.useComponents,
        enableCache: envConfig.enableCache,
        cacheSize: parseInt(process.env.NEXT_PUBLIC_CACHE_SIZE || '100', 10),
        fallbackEnabled: envConfig.fallbackEnabled
      },
      performance: {
        batchSize: parseInt(process.env.NEXT_PUBLIC_BATCH_SIZE || '10', 10),
        timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '10000', 10),
        retryAttempts: parseInt(process.env.NEXT_PUBLIC_RETRY_ATTEMPTS || '3', 10),
        concurrencyLimit: parseInt(process.env.NEXT_PUBLIC_CONCURRENCY_LIMIT || '5', 10)
      }
    });

    console.log('[应用通信] 配置初始化完成:', envConfig);
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    // 设置定期报告
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, 30000); // 每30秒报告一次

    // 监控关键指标
    this.setupCriticalMetricMonitoring();
  }

  /**
   * 报告性能指标
   */
  private reportPerformanceMetrics(): void {
    const metrics = this.performanceMonitor.getMetricNames();
    
    if (metrics.length > 0) {
      console.log(`[性能报告] 当前监控的指标: ${metrics.length} 个`);
      
      metrics.slice(0, 5).forEach(metricName => {
        const stats = this.performanceMonitor.getStats(metricName);
        if (stats) {
          console.log(`  ${metricName}: 平均 ${stats.avg.toFixed(2)}, 最大 ${stats.max.toFixed(2)}`);
        }
      });
    }
  }

  /**
   * 设置关键指标监控
   */
  private setupCriticalMetricMonitoring(): void {
    // 监控文件处理时间
    this.performanceMonitor.addObserver((metric) => {
      if (metric.name === 'epub.processing.time' && metric.value > 5000) {
        console.warn(`[性能警告] EPUB处理时间过长: ${metric.value.toFixed(2)}ms`);
      }
    });

    // 监控缓存命中率
    this.performanceMonitor.addObserver((metric) => {
      if (metric.name === 'cache.hitRate' && metric.value < 50) {
        console.warn(`[性能警告] 缓存命中率偏低: ${metric.value.toFixed(1)}%`);
      }
    });

    // 监控错误率
    this.performanceMonitor.addObserver((metric) => {
      if (metric.name === 'error.count' && metric.value > 5) {
        console.error(`[严重警告] 错误次数过多: ${metric.value}`);
      }
    });
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      components: {
        eventBus: 'active',
        performanceMonitor: 'active',
        configManager: 'active',
        fileProcessorBridge: 'active'
      },
      performance: {
        metricsCount: this.performanceMonitor.getMetricNames().length,
        cacheStats: this.bridge.getPerformanceStats().cacheStats
      },
      configuration: this.configManager.getConfig()
    };
  }

  /**
   * 手动触发性能报告
   */
  triggerPerformanceReport(): void {
    this.reportPerformanceMetrics();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    eventBus.publish({
      type: MessageType.COMPONENT_READY,
      payload: {
        component: 'MainApplication',
        action: 'cleanup',
        timestamp: Date.now()
      },
      source: 'AppEventHandler'
    });
  }
}

// React Hook for application communication
import React from 'react';

export function useAppCommunication() {
  const [systemStatus, setSystemStatus] = React.useState<any>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  
  const handler = React.useMemo(() => AppEventHandler.getInstance(), []);

  // 初始化通信系统
  React.useEffect(() => {
    if (!isInitialized) {
      setSystemStatus(handler.getSystemStatus());
      setIsInitialized(true);
      
      console.log('[应用通信] React通信系统已初始化');
    }
  }, [handler, isInitialized]);

  // 监听系统状态变化
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSystemStatus(handler.getSystemStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, [handler]);

  // 提供操作方法
  const triggerReport = React.useCallback(() => {
    handler.triggerPerformanceReport();
  }, [handler]);

  const updateBridgeConfig = React.useCallback((config: any) => {
    // 通过公共方法更新配置
    eventBus.publish({
      type: MessageType.CONFIG_CHANGED,
      payload: {
        component: 'FileProcessorBridge',
        newConfig: config
      },
      source: 'ReactHook'
    });
    setSystemStatus(handler.getSystemStatus());
  }, [handler]);

  return {
    systemStatus,
    isInitialized,
    triggerReport,
    updateBridgeConfig
  };
}

// 应用启动时自动初始化
if (typeof window !== 'undefined') {
  // 客户端环境
  AppEventHandler.getInstance();
} else {
  // 服务端环境
  AppEventHandler.getInstance();
}

// 导出单例实例
export const appEventHandler = AppEventHandler.getInstance();
export default appEventHandler;
