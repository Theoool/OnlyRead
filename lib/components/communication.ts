/**
 * 组件间通信系统
 * Component Communication System
 */

// 消息类型枚举
export enum MessageType {
  COMPONENT_READY = 'COMPONENT_READY',
  DATA_TRANSFORMED = 'DATA_TRANSFORMED',
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  PERFORMANCE_UPDATE = 'PERFORMANCE_UPDATE',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

// 消息接口
export interface Message {
  type: MessageType;
  payload: any;
  timestamp: number;
  source: string;
  target?: string;
}

// 事件总线类
export class EventBus {
  private listeners: Map<MessageType, Array<(message: Message) => void>> = new Map();
  private middlewares: Array<(message: Message) => Message> = [];

  // 订阅消息
  subscribe(type: MessageType, listener: (message: Message) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);

    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  // 发布消息
  publish(message: Omit<Message, 'timestamp'>): void {
    const fullMessage: Message = {
      ...message,
      timestamp: Date.now()
    };

    // 应用中间件
    let processedMessage = fullMessage;
    for (const middleware of this.middlewares) {
      processedMessage = middleware(processedMessage);
    }

    // 通知监听器
    const listeners = this.listeners.get(processedMessage.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(processedMessage);
        } catch (error) {
          console.error('消息处理错误:', error);
        }
      });
    }
  }

  // 添加中间件
  use(middleware: (message: Message) => Message): void {
    this.middlewares.push(middleware);
  }

  // 清除所有监听器
  clear(): void {
    this.listeners.clear();
    this.middlewares = [];
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();

// 组件通信钩子
import React from 'react';

export function useComponentCommunication(componentName: string) {
  const [messages, setMessages] = React.useState<Message[]>([]);

  // 发送消息
  const sendMessage = React.useCallback((type: MessageType, payload: any, target?: string) => {
    eventBus.publish({
      type,
      payload,
      source: componentName,
      target
    });
  }, [componentName]);

  // 订阅消息
  const subscribe = React.useCallback((type: MessageType, handler: (message: Message) => void) => {
    return eventBus.subscribe(type, handler);
  }, []);

  // 监听特定类型的消息
  const useMessageListener = React.useCallback((type: MessageType, handler: (payload: any) => void) => {
    React.useEffect(() => {
      return subscribe(type, (message) => {
        // 只处理来自其他组件的消息
        if (message.source !== componentName) {
          handler(message.payload);
        }
      });
    }, [type, handler, subscribe, componentName]);
  }, [componentName, subscribe]);

  return {
    sendMessage,
    subscribe,
    useMessageListener,
    messages
  };
}

// 性能监控通信
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 记录性能指标
  recordMetric(metricName: string, value: number): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    
    const metrics = this.metrics.get(metricName)!;
    metrics.push(value);
    
    // 保持最近100个数据点
    if (metrics.length > 100) {
      metrics.shift();
    }

    // 通知性能更新
    eventBus.publish({
      type: MessageType.PERFORMANCE_UPDATE,
      payload: {
        metric: metricName,
        value,
        average: this.getAverage(metricName),
        timestamp: Date.now()
      },
      source: 'PerformanceMonitor'
    });
  }

  // 获取平均值
  getAverage(metricName: string): number {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, val) => acc + val, 0);
    return sum / metrics.length;
  }

  // 获取统计数据
  getStats(metricName: string): { min: number; max: number; avg: number; count: number } | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) return null;

    const sorted = [...metrics].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: this.getAverage(metricName),
      count: metrics.length
    };
  }

  // 获取所有指标名称
  getAllMetrics(): string[] {
    return Array.from(this.metrics.keys());
  }
}

// 错误处理通信
export class ErrorHandler {
  static handleError(error: Error, component: string, context?: any): void {
    console.error(`[${component}] 错误:`, error);

    eventBus.publish({
      type: MessageType.ERROR_OCCURRED,
      payload: {
        error: error.message,
        stack: error.stack,
        component,
        context,
        timestamp: Date.now()
      },
      source: component
    });
  }

  static useErrorHandler(componentName: string): (error: Error, context?: any) => void {
    return React.useCallback((error: Error, context?: any) => {
      ErrorHandler.handleError(error, componentName, context);
    }, [componentName]);
  }
}
