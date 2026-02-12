#!/usr/bin/env node

/**
 * 性能基准测试运行器
 * Performance Benchmark Runner
 */

import { PredefinedBenchmarks, PerformanceRegressionDetector } from './benchmark';

async function runAllBenchmarks() {
  console.log('🚀 开始运行性能基准测试...\n');

  try {
    // 运行文本处理基准测试
    console.log('📝 文本处理基准测试:');
    const textSuite = PredefinedBenchmarks.createTextProcessingBenchmark();
    const textResults = await textSuite.runAll();

    // 运行缓存基准测试
    console.log('\n💾 缓存基准测试:');
    const cacheSuite = PredefinedBenchmarks.createCacheBenchmark();
    const cacheResults = await cacheSuite.runAll();

    // 运行组件基准测试
    console.log('\n🧩 组件基准测试:');
    const componentSuite = PredefinedBenchmarks.createComponentBenchmark();
    const componentResults = await componentSuite.runAll();

    // 性能回归检测
    console.log('\n🔍 性能回归检测:');
    const detector = new PerformanceRegressionDetector();
    
    // 设置基线（这里使用当前结果作为示例）
    detector.setBaseline(textResults);
    detector.setThreshold('文本清理', 15); // 15%阈值
    detector.setThreshold('HTML转换', 10); // 10%阈值
    detector.setThreshold('目录生成', 20); // 20%阈值

    // 模拟一些性能退化
    const simulatedDegradedResults = new Map(textResults);
    for (const [name, result] of simulatedDegradedResults) {
      // 模拟15%的性能退化
      const degradedResult = { ...result };
      degradedResult.averageTime = result.averageTime * 1.15;
      simulatedDegradedResults.set(name, degradedResult);
    }

    const regressions = detector.detectRegressions(simulatedDegradedResults);
    const report = detector.generateReport(regressions);
    console.log(report);

    console.log('\n✅ 所有基准测试执行完毕！');
    
    // 汇总统计
    const allResults = new Map([
      ...textResults,
      ...cacheResults,
      ...componentResults
    ]);

    console.log('\n📈 总体性能汇总:');
    let totalOps = 0;
    let totalTime = 0;
    
    for (const [, result] of allResults) {
      totalOps += result.iterations;
      totalTime += result.totalTime;
    }
    
    console.log(`   总操作数: ${totalOps.toLocaleString()}`);
    console.log(`   总耗时: ${(totalTime / 1000).toFixed(2)} 秒`);
    console.log(`   平均吞吐量: ${(totalOps / (totalTime / 1000)).toFixed(2)} ops/sec`);

  } catch (error) {
    console.error('❌ 基准测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllBenchmarks().catch(console.error);
}

export { runAllBenchmarks };
