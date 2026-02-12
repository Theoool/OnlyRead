/**
 * 性能基准测试套件
 * Performance Benchmark Suite
 */

import { PerformanceMonitor } from './monitor';

// 基准测试配置
export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  name: string;
  description?: string;
}

// 基准测试结果
export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number; // 每秒操作数
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    difference: NodeJS.MemoryUsage;
  };
}

// 基准测试函数类型
export type BenchmarkFunction = () => Promise<void> | void;

// 基准测试套件类
export class BenchmarkSuite {
  private benchmarks: Map<string, { fn: BenchmarkFunction; config: BenchmarkConfig }> = new Map();
  private results: Map<string, BenchmarkResult> = new Map();
  private monitor: PerformanceMonitor;

  constructor() {
    this.monitor = PerformanceMonitor.getInstance({
      bufferSize: 10000,
      sampleRate: 1.0,
      enableLogging: false
    });
  }

  // 添加基准测试
  add(name: string, fn: BenchmarkFunction, config: Partial<BenchmarkConfig> = {}): void {
    const fullConfig: BenchmarkConfig = {
      iterations: 1000,
      warmupIterations: 100,
      name,
      description: '',
      ...config
    };

    this.benchmarks.set(name, { fn, config: fullConfig });
  }

  // 运行单个基准测试
  async run(name: string): Promise<BenchmarkResult> {
    const benchmark = this.benchmarks.get(name);
    if (!benchmark) {
      throw new Error(`基准测试 "${name}" 未找到`);
    }

    const { fn, config } = benchmark;
    
    // 预热
    console.log(`预热 ${config.name} (${config.warmupIterations} 次)...`);
    for (let i = 0; i < config.warmupIterations; i++) {
      await Promise.resolve(fn());
    }

    // 收集内存使用前的状态
    const memoryBefore = process.memoryUsage();

    // 运行基准测试
    console.log(`运行 ${config.name} (${config.iterations} 次)...`);
    const times: number[] = [];
    
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      await Promise.resolve(fn());
      const endTime = performance.now();
      times.push(endTime - startTime);
      
      // 记录到性能监控器
      this.monitor.record(`${config.name}.iteration`, endTime - startTime);
    }

    // 收集内存使用后的状态
    const memoryAfter = process.memoryUsage();

    // 计算统计信息
    const sortedTimes = [...times].sort((a, b) => a - b);
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / times.length;
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[sortedTimes.length - 1];
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99Time = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    const throughput = (config.iterations / (totalTime / 1000)); // 操作/秒

    const result: BenchmarkResult = {
      name: config.name,
      iterations: config.iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      medianTime,
      p95Time,
      p99Time,
      throughput,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        difference: {
          rss: memoryAfter.rss - memoryBefore.rss,
          heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          external: memoryAfter.external - memoryBefore.external,
          arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers
        }
      }
    };

    this.results.set(name, result);
    return result;
  }

  // 运行所有基准测试
  async runAll(): Promise<Map<string, BenchmarkResult>> {
    console.log('🚀 开始运行基准测试套件...\n');
    
    for (const [name] of this.benchmarks) {
      try {
        const result = await this.run(name);
        this.printResult(result);
      } catch (error) {
        console.error(`❌ 基准测试 "${name}" 失败:`, error);
      }
    }

    console.log('\n✅ 基准测试套件执行完毕！');
    return new Map(this.results);
  }

  // 打印结果
  private printResult(result: BenchmarkResult): void {
    console.log(`\n📊 ${result.name} 测试结果:`);
    console.log(`   迭代次数: ${result.iterations}`);
    console.log(`   总时间: ${result.totalTime.toFixed(2)}ms`);
    console.log(`   平均时间: ${result.averageTime.toFixed(2)}ms`);
    console.log(`   最小时间: ${result.minTime.toFixed(2)}ms`);
    console.log(`   最大时间: ${result.maxTime.toFixed(2)}ms`);
    console.log(`   中位数时间: ${result.medianTime.toFixed(2)}ms`);
    console.log(`   95th百分位: ${result.p95Time.toFixed(2)}ms`);
    console.log(`   99th百分位: ${result.p99Time.toFixed(2)}ms`);
    console.log(`   吞吐量: ${result.throughput.toFixed(2)} ops/sec`);
    
    console.log(`   内存使用变化:`);
    console.log(`     RSS: ${(result.memoryUsage.difference.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`     Heap Used: ${(result.memoryUsage.difference.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`     Heap Total: ${(result.memoryUsage.difference.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  }

  // 获取结果
  getResults(): Map<string, BenchmarkResult> {
    return new Map(this.results);
  }

  // 清除结果
  clearResults(): void {
    this.results.clear();
  }

  // 与历史结果比较
  compareWithHistory(history: Map<string, BenchmarkResult>): Map<string, any> {
    const comparison = new Map();
    
    for (const [name, currentResult] of this.results) {
      const historicalResult = history.get(name);
      if (historicalResult) {
        const improvement = ((historicalResult.averageTime - currentResult.averageTime) / historicalResult.averageTime) * 100;
        
        comparison.set(name, {
          current: currentResult.averageTime,
          historical: historicalResult.averageTime,
          improvement: improvement,
          isImproved: improvement > 0,
          significance: Math.abs(improvement)
        });
      }
    }
    
    return comparison;
  }
}

// 预定义的基准测试
export class PredefinedBenchmarks {
  static createTextProcessingBenchmark() {
    const suite = new BenchmarkSuite();
    
    // 模拟文本处理
    suite.add('文本清理', async () => {
      const text = '  Hello   World  \n\n\nTest  '.repeat(100);
      const cleaned = text
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      // 不返回值，避免类型错误
    }, { iterations: 5000, warmupIterations: 500 });

    suite.add('HTML转换', async () => {
      const html = '<h1>Title</h1><p>Hello <strong>World</strong></p>'.repeat(50);
      const markdown = html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      // 不返回值，避免类型错误
    }, { iterations: 3000, warmupIterations: 300 });

    suite.add('目录生成', async () => {
      const markdown = '# 第一章\n## 第一节\n### 小节\n'.repeat(20);
      const lines = markdown.split('\n');
      const toc = lines
        .map(line => line.match(/^(#{1,6})\s+(.+)$/))
        .filter(Boolean)
        .map(match => ({
          level: match![1].length,
          title: match![2].trim()
        }));
      // 不返回值，避免类型错误
    }, { iterations: 2000, warmupIterations: 200 });

    return suite;
  }

  static createCacheBenchmark() {
    const suite = new BenchmarkSuite();
    const cache = new Map<string, any>();

    suite.add('缓存写入', async () => {
      const key = `key_${Math.random()}`;
      cache.set(key, { data: 'test data', timestamp: Date.now() });
    }, { iterations: 10000, warmupIterations: 1000 });

    suite.add('缓存读取', async () => {
      const keys = Array.from(cache.keys());
      if (keys.length > 0) {
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return cache.get(randomKey);
      }
    }, { iterations: 10000, warmupIterations: 1000 });

    suite.add('缓存淘汰', async () => {
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
    }, { iterations: 5000, warmupIterations: 500 });

    return suite;
  }

  static createComponentBenchmark() {
    const suite = new BenchmarkSuite();

    suite.add('组件验证', async () => {
      const component = {
        name: 'TestComponent',
        version: '1.0.0',
        validate: (input: any) => typeof input?.text === 'string'
      };
      
      const result = component.validate({ text: 'test' });
      // 不返回值，避免类型错误
    }, { iterations: 10000, warmupIterations: 1000 });

    suite.add('组件处理', async () => {
      const component = {
        name: 'TestComponent',
        version: '1.0.0',
        process: async (input: any) => ({
          processed: input.text.toUpperCase(),
          timestamp: Date.now()
        }),
        validate: (input: any) => typeof input?.text === 'string'
      };
      
      if (component.validate({ text: 'test' })) {
        const result = await component.process({ text: 'test' });
        // 不返回值，避免类型错误
      }
    }, { iterations: 5000, warmupIterations: 500 });

    return suite;
  }
}

// 性能回归检测器
export class PerformanceRegressionDetector {
  private baseline: Map<string, BenchmarkResult> = new Map();
  private thresholds: Map<string, number> = new Map();

  // 设置基线
  setBaseline(results: Map<string, BenchmarkResult>): void {
    this.baseline = new Map(results);
  }

  // 设置阈值（百分比下降）
  setThreshold(metric: string, threshold: number): void {
    this.thresholds.set(metric, threshold);
  }

  // 检测回归
  detectRegressions(currentResults: Map<string, BenchmarkResult>): Map<string, any> {
    const regressions = new Map();

    for (const [name, currentResult] of currentResults) {
      const baselineResult = this.baseline.get(name);
      if (!baselineResult) continue;

      const threshold = this.thresholds.get(name) || 10; // 默认10%阈值
      const degradation = ((currentResult.averageTime - baselineResult.averageTime) / baselineResult.averageTime) * 100;

      if (degradation > threshold) {
        regressions.set(name, {
          baseline: baselineResult.averageTime,
          current: currentResult.averageTime,
          degradation: degradation,
          threshold: threshold
        });
      }
    }

    return regressions;
  }

  // 生成回归报告
  generateReport(regressions: Map<string, any>): string {
    if (regressions.size === 0) {
      return '✅ 未检测到性能回归';
    }

    let report = '❌ 检测到性能回归:\n\n';
    
    for (const [name, regression] of regressions) {
      report += `${name}:\n`;
      report += `  基线: ${regression.baseline.toFixed(2)}ms\n`;
      report += `  当前: ${regression.current.toFixed(2)}ms\n`;
      report += `  退化: ${regression.degradation.toFixed(2)}%\n`;
      report += `  阈值: ${regression.threshold}%\n\n`;
    }

    return report;
  }
}
