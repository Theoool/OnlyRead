/**
 * 高级配置管理系统
 * Advanced Configuration Management System
 */

import { z } from 'zod';
import { eventBus, MessageType } from './communication';

// 配置 Schema 定义
export const ConfigSchema = z.object({
  // 核心功能配置
  core: z.object({
    useComponents: z.boolean().default(true),
    enableCache: z.boolean().default(true),
    cacheSize: z.number().min(10).max(1000).default(100),
    fallbackEnabled: z.boolean().default(true)
  }),

  // 性能配置
  performance: z.object({
    batchSize: z.number().min(1).max(100).default(10),
    timeout: z.number().min(1000).max(30000).default(10000),
    retryAttempts: z.number().min(0).max(5).default(3),
    concurrencyLimit: z.number().min(1).max(20).default(5)
  }),

  // 日志配置
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableConsole: z.boolean().default(true),
    enableFileLogging: z.boolean().default(false),
    maxLogSize: z.number().default(10 * 1024 * 1024) // 10MB
  }),

  // UI 配置
  ui: z.object({
    theme: z.enum(['light', 'dark', 'auto']).default('auto'),
    language: z.enum(['zh', 'en']).default('zh'),
    animationsEnabled: z.boolean().default(true),
    autoSave: z.boolean().default(true)
  })
});

export type Config = z.infer<typeof ConfigSchema>;

// 默认配置
const DEFAULT_CONFIG: Config = {
  core: {
    useComponents: true,
    enableCache: true,
    cacheSize: 100,
    fallbackEnabled: true
  },
  performance: {
    batchSize: 10,
    timeout: 10000,
    retryAttempts: 3,
    concurrencyLimit: 5
  },
  logging: {
    level: 'info',
    enableConsole: true,
    enableFileLogging: false,
    maxLogSize: 10 * 1024 * 1024
  },
  ui: {
    theme: 'auto',
    language: 'zh',
    animationsEnabled: true,
    autoSave: true
  }
};

// 配置管理器类
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private storageKey = 'md-transformer-config';

  private constructor() {
    this.config = this.loadConfig();
    this.setupWatchers();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // 加载配置
  private loadConfig(): Config {
    try {
      const savedConfig = localStorage.getItem(this.storageKey);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        return ConfigSchema.parse(parsed);
      }
    } catch (error) {
      console.warn('配置加载失败，使用默认配置:', error);
    }
    
    return DEFAULT_CONFIG;
  }

  // 保存配置
  private saveConfig(): void {
    // 仅在客户端环境保存配置
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.error('配置保存失败:', error);
    }
  }

  // 设置观察者
  private setupWatchers(): void {
    // 监听配置变更事件
    eventBus.subscribe(MessageType.CONFIG_CHANGED, (message) => {
      if (message.source !== 'ConfigManager') {
        this.handleExternalConfigChange(message.payload);
      }
    });
  }

  // 处理外部配置变更
  private handleExternalConfigChange(newConfig: Partial<Config>): void {
    this.updateConfig(newConfig);
  }

  // 获取完整配置
  getConfig(): Config {
    return { ...this.config };
  }

  // 获取部分配置
  get<K extends keyof Config>(section: K): Config[K] {
    return { ...this.config[section] };
  }

  // 更新配置
  updateConfig(updates: Partial<Config> | ((current: Config) => Partial<Config>)): void {
    try {
      const updatesToApply = typeof updates === 'function' 
        ? updates(this.config)
        : updates;

      // 验证更新
      const newConfig = ConfigSchema.parse({
        ...this.config,
        ...updatesToApply
      });

      // 应用更新
      this.config = newConfig;
      this.saveConfig();

      // 通知配置变更
      eventBus.publish({
        type: MessageType.CONFIG_CHANGED,
        payload: newConfig,
        source: 'ConfigManager'
      });

      console.log('配置已更新:', newConfig);
    } catch (error) {
      console.error('配置更新失败:', error);
      throw error;
    }
  }

  // 重置为默认配置
  resetToDefault(): void {
    this.updateConfig(DEFAULT_CONFIG);
  }

  // 导出配置
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // 导入配置
  importConfig(configString: string): void {
    try {
      const parsed = JSON.parse(configString);
      this.updateConfig(parsed);
    } catch (error) {
      console.error('配置导入失败:', error);
      throw new Error('无效的配置格式');
    }
  }

  // 验证配置
  validateConfig(config: unknown): config is Config {
    return ConfigSchema.safeParse(config).success;
  }
}

// React Hook for configuration
import React from 'react';

export function useConfig(): {
  config: Config;
  updateConfig: (updates: Partial<Config>) => void;
  resetConfig: () => void;
} {
  const [config, setConfig] = React.useState(() => ConfigManager.getInstance().getConfig());
  
  const updateConfig = React.useCallback((updates: Partial<Config>) => {
    ConfigManager.getInstance().updateConfig(updates);
    setConfig(ConfigManager.getInstance().getConfig());
  }, []);

  const resetConfig = React.useCallback(() => {
    ConfigManager.getInstance().resetToDefault();
    setConfig(ConfigManager.getInstance().getConfig());
  }, []);

  // 监听配置变更
  React.useEffect(() => {
    const unsubscribe = eventBus.subscribe(MessageType.CONFIG_CHANGED, (message) => {
      if (message.source !== 'ConfigManager') {
        setConfig(ConfigManager.getInstance().getConfig());
      }
    });

    return unsubscribe;
  }, []);

  return {
    config,
    updateConfig,
    resetConfig
  };
}

// 环境变量配置适配器
export class EnvConfigAdapter {
  static getEnvConfig(): Partial<Config> {
    return {
      core: {
        useComponents: process.env.NEXT_PUBLIC_USE_COMPONENT_ARCH === 'true',
        enableCache: process.env.NEXT_PUBLIC_CACHE_ENABLED !== 'false',
        cacheSize: parseInt(process.env.NEXT_PUBLIC_CACHE_SIZE || '100', 10),
        fallbackEnabled: process.env.NEXT_PUBLIC_FALLBACK_ENABLED !== 'false'
      },
      logging: {
        level: (process.env.NEXT_PUBLIC_LOG_LEVEL as any) || 'info',
        enableConsole: process.env.NEXT_PUBLIC_CONSOLE_LOGGING !== 'false',
        enableFileLogging: process.env.NEXT_PUBLIC_FILE_LOGGING === 'true',
        maxLogSize: parseInt(process.env.NEXT_PUBLIC_MAX_LOG_SIZE || '10485760', 10)
      },
      ui: {
        theme: (process.env.NEXT_PUBLIC_THEME as any) || 'auto',
        language: (process.env.NEXT_PUBLIC_LANGUAGE as any) || 'zh',
        animationsEnabled: process.env.NEXT_PUBLIC_ANIMATIONS_ENABLED !== 'false',
        autoSave: process.env.NEXT_PUBLIC_AUTO_SAVE === 'true'
      }
    };
  }

  static applyEnvConfig(): void {
    const envConfig = this.getEnvConfig();
    ConfigManager.getInstance().updateConfig(envConfig);
  }
}

// 配置迁移工具
export class ConfigMigration {
  static migrate(oldVersion: string, newVersion: string, config: any): any {
    // 版本迁移逻辑
    const migrations: Record<string, (config: any) => any> = {
      '1.0.0': (config: any) => {
        // 从 1.0.0 迁移到 2.0.0
        return {
          ...config,
          core: {
            ...config.core,
            fallbackEnabled: true
          },
          performance: {
            batchSize: 10,
            timeout: 10000,
            retryAttempts: 3,
            concurrencyLimit: 5
          }
        };
      }
    };

    let migratedConfig = config;
    let currentVersion = oldVersion;

    // 按顺序执行迁移
    Object.keys(migrations).forEach(version => {
      if (this.compareVersions(currentVersion, version) < 0) {
        migratedConfig = migrations[version](migratedConfig);
        currentVersion = version;
      }
    });

    return migratedConfig;
  }

  private static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }
}
