/**
 * 性能监控核心系统
 * Performance Monitoring Core System
 */

// 性能指标类型
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  context?: Record<string, any>;
  tags?: string[];
}

// 性能统计信息
export interface PerformanceStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  count: number;
  sum: number;
}

// 监控配置
export interface MonitorConfig {
  bufferSize: number;
  sampleRate: number;
  alertThresholds: Record<string, number>;
  enableLogging: boolean;
}

// 默认配置
const DEFAULT_CONFIG: MonitorConfig = {
  bufferSize: 1000,
  sampleRate: 1.0,
  alertThresholds: {
    'processing.time': 5000, // 5秒
    'memory.usage': 80, // 80%
    'cache.hitRate': 70 // 70%
  },
  enableLogging: true
};

// 性能监控器类
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private config: MonitorConfig;
  private observers: Array<(metric: PerformanceMetric) => void> = [];
  private alerts: Array<(alert: PerformanceAlert) => void> = [];
  
  private constructor(config: Partial<MonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startSystemMonitoring();
  }

  static getInstance(config?: Partial<MonitorConfig>): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(config);
    }
    return PerformanceMonitor.instance;
  }

  // 记录性能指标
  record(name: string, value: number, context?: Record<string, any>, tags?: string[]): void {
    // 采样控制
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      context,
      tags
    };

    // 存储指标
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name)!;
    metricList.push(metric);

    // 限制缓冲区大小
    if (metricList.length > this.config.bufferSize) {
      metricList.shift();
    }

    // 通知观察者
    this.notifyObservers(metric);

    // 检查告警阈值
    this.checkAlerts(metric);

    // 记录日志
    if (this.config.enableLogging) {
      this.logMetric(metric);
    }
  }

  // 获取指标统计信息
  getStats(metricName: string): PerformanceStats | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;

    return {
      min: values[0],
      max: values[count - 1],
      avg,
      median: values[Math.floor(count / 2)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)],
      count,
      sum
    };
  }

  // 获取所有指标名称
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  // 添加观察者
  addObserver(observer: (metric: PerformanceMetric) => void): void {
    this.observers.push(observer);
  }

  // 移除观察者
  removeObserver(observer: (metric: PerformanceMetric) => void): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  // 添加告警处理器
  addAlertHandler(handler: (alert: PerformanceAlert) => void): void {
    this.alerts.push(handler);
  }

  // 获取最近的指标数据
  getRecentMetrics(metricName: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName);
    if (!metrics) return [];
    
    return metrics.slice(-limit);
  }

  // 清除历史数据
  clearMetrics(metricName?: string): void {
    if (metricName) {
      this.metrics.delete(metricName);
    } else {
      this.metrics.clear();
    }
  }

  // 导出数据
  exportData(): Record<string, PerformanceMetric[]> {
    const result: Record<string, PerformanceMetric[]> = {};
    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = [...metrics];
    }
    return result;
  }

  // 私有方法
  private notifyObservers(metric: PerformanceMetric): void {
    this.observers.forEach(observer => {
      try {
        observer(metric);
      } catch (error) {
        console.error('观察者处理错误:', error);
      }
    });
  }

  private checkAlerts(metric: PerformanceMetric): void {
    const threshold = this.config.alertThresholds[metric.name];
    if (threshold !== undefined && metric.value > threshold) {
      const alert: PerformanceAlert = {
        metric,
        threshold,
        severity: this.calculateSeverity(metric.value, threshold),
        timestamp: Date.now()
      };
      
      this.alerts.forEach(handler => {
        try {
          handler(alert);
        } catch (error) {
          console.error('告警处理器错误:', error);
        }
      });
    }
  }

  private calculateSeverity(value: number, threshold: number): AlertSeverity {
    const ratio = value / threshold;
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'warning';
    return 'info';
  }

  private logMetric(metric: PerformanceMetric): void {
    console.log(`[性能监控] ${metric.name}: ${metric.value}`, {
      timestamp: new Date(metric.timestamp).toISOString(),
      context: metric.context,
      tags: metric.tags
    });
  }

  private startSystemMonitoring(): void {
    // 定期收集系统指标
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // 每5秒收集一次
  }

  private collectSystemMetrics(): void {
    // 收集内存使用情况
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
      this.record('memory.usage', memoryMB, { 
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        external: memory.external
      });
    }

    // 收集CPU使用情况（Node.js环境）
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const cpu = process.cpuUsage();
      const cpuPercent = (cpu.user + cpu.system) / 1000000; // 转换为毫秒
      this.record('cpu.usage', cpuPercent);
    }
  }
}

// 告警相关类型
export interface PerformanceAlert {
  metric: PerformanceMetric;
  threshold: number;
  severity: AlertSeverity;
  timestamp: number;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

// 性能计时器装饰器
export function performanceTimer(metricName: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      const startTime = performance.now();
      const monitor = PerformanceMonitor.getInstance();
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (result instanceof Promise) {
          return result.then((resolvedResult) => {
            const endTime = performance.now();
            monitor.record(`${metricName}.duration`, endTime - startTime);
            return resolvedResult;
          }).catch((error) => {
            const endTime = performance.now();
            monitor.record(`${metricName}.duration`, endTime - startTime);
            monitor.record(`${metricName}.errors`, 1);
            throw error;
          });
        } else {
          const endTime = performance.now();
          monitor.record(`${metricName}.duration`, endTime - startTime);
          return result;
        }
      } catch (error) {
        const endTime = performance.now();
        monitor.record(`${metricName}.duration`, endTime - startTime);
        monitor.record(`${metricName}.errors`, 1);
        throw error;
      }
    };
    
    return descriptor;
  };
}

// React Hook for performance monitoring
import React from 'react';

export function usePerformanceMonitor() {
  const [metrics, setMetrics] = React.useState<Record<string, PerformanceStats>>({});
  const monitor = React.useMemo(() => PerformanceMonitor.getInstance(), []);

  // 获取指标统计
  const getMetricStats = React.useCallback((metricName: string) => {
    return monitor.getStats(metricName);
  }, [monitor]);

  // 记录指标
  const recordMetric = React.useCallback((
    name: string, 
    value: number, 
    context?: Record<string, any>,
    tags?: string[]
  ) => {
    monitor.record(name, value, context, tags);
  }, [monitor]);

  // 监听指标变化
  React.useEffect(() => {
    const observer = (metric: PerformanceMetric) => {
      const stats = monitor.getStats(metric.name);
      if (stats) {
        setMetrics(prev => ({
          ...prev,
          [metric.name]: stats
        }));
      }
    };

    monitor.addObserver(observer);
    
    return () => {
      monitor.removeObserver(observer);
    };
  }, [monitor]);

  return {
    metrics,
    getMetricStats,
    recordMetric,
    monitor
  };
}

// 预定义的性能指标收集器
export class BuiltInMetrics {
  static collectProcessingMetrics() {
    const monitor = PerformanceMonitor.getInstance();
    
    // 组件处理时间
    monitor.addObserver((metric) => {
      if (metric.name.includes('component')) {
        monitor.record('component.processing.count', 1, metric.context, metric.tags);
      }
    });
  }

  static collectCacheMetrics() {
    const monitor = PerformanceMonitor.getInstance();
    
    // 缓存命中率计算
    let cacheHits = 0;
    let cacheTotal = 0;
    
    monitor.addObserver((metric) => {
      if (metric.name === 'cache.hit') {
        cacheHits += metric.value;
        cacheTotal++;
      } else if (metric.name === 'cache.miss') {
        cacheTotal++;
      }
      
      if (cacheTotal > 0) {
        const hitRate = (cacheHits / cacheTotal) * 100;
        monitor.record('cache.hitRate', hitRate);
      }
    });
  }

  static collectErrorMetrics() {
    const monitor = PerformanceMonitor.getInstance();
    
    monitor.addObserver((metric) => {
      if (metric.name.includes('error') || metric.name.includes('exception')) {
        monitor.record('error.rate', 1, metric.context, metric.tags);
      }
    });
  }
}
