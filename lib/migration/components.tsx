/**
 * Migration React Components
 * React 集成组件
 */

'use client';

import React from 'react';
import { CompatibleService, migrationManager } from './core';

// React Hook 集成
export function useCompatibleService() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const service = React.useMemo(() => new CompatibleService(), []);

  const transform = React.useCallback(async (html: string) => {
    setIsProcessing(true);
    try {
      return await service.transformHTML(html);
    } finally {
      setIsProcessing(false);
    }
  }, [service]);

  const extract = React.useCallback(async (url: string, html: string) => {
    setIsProcessing(true);
    try {
      return await service.extractSiteContent(url, html);
    } finally {
      setIsProcessing(false);
    }
  }, [service]);

  const generateTOC = React.useCallback(async (markdown: string) => {
    setIsProcessing(true);
    try {
      return await service.generateTOC(markdown);
    } finally {
      setIsProcessing(false);
    }
  }, [service]);

  const getStats = React.useCallback(() => migrationManager.getPerformanceStats(), []);

  return {
    transform,
    extract,
    generateTOC,
    isProcessing,
    getStats,
    service
  };
}

// 迁移状态监控组件
export function MigrationStatus() {
  const [stats, setStats] = React.useState<any>(null);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(migrationManager.getPerformanceStats());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 10000,
      minWidth: '200px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🔄 迁移状态</div>
      <div>⏱️ 平均耗时: {stats.averageDuration.toFixed(2)}ms</div>
      <div>✅ 成功率: {stats.successRate.toFixed(1)}%</div>
      <div>🔙 回退次数: {stats.fallbackCount}</div>
      <div>📊 操作总数: {stats.totalOperations}</div>
    </div>
  );
}

// 配置面板组件
export function MigrationConfigPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState({
    useNewVersion: true,
    fallbackEnabled: true,
    logEnabled: true,
    performanceThreshold: 1000
  });

  const togglePanel = () => setIsOpen(!isOpen);

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    migrationManager.updateConfig(newConfig);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={togglePanel}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: '#0070f3',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 10000
        }}
      >
        ⚙️ 配置
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '15px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 10000,
      minWidth: '250px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>🔧 迁移配置</h3>
        <button 
          onClick={togglePanel}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={config.useNewVersion}
            onChange={(e) => updateConfig('useNewVersion', e.target.checked)}
          />
          使用新版本
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={config.fallbackEnabled}
            onChange={(e) => updateConfig('fallbackEnabled', e.target.checked)}
          />
          启用回退
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={config.logEnabled}
            onChange={(e) => updateConfig('logEnabled', e.target.checked)}
          />
          启用日志
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          性能阈值 (ms):
        </label>
        <input
          type="number"
          value={config.performanceThreshold}
          onChange={(e) => updateConfig('performanceThreshold', parseInt(e.target.value))}
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>

      <button
        onClick={() => migrationManager.clearCache()}
        style={{
          width: '100%',
          padding: '8px',
          background: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        清除缓存
      </button>
    </div>
  );
}

// 性能测试组件
export function PerformanceTester() {
  const [testResults, setTestResults] = React.useState<any[]>([]);
  const { transform, extract, generateTOC } = useCompatibleService();

  const runTests = async () => {
    const tests = [
      { name: '小文档转换', html: '<p>Hello World</p>'.repeat(10) },
      { name: '中等文档转换', html: '<div><h1>Title</h1><p>' + 'Content '.repeat(100) + '</p></div>' },
      { name: '大文档转换', html: '<article>' + '<section><h2>Section</h2><p>' + 'Large content '.repeat(500) + '</p></section>'.repeat(5) + '</article>' }
    ];

    const results = [];
    
    for (const test of tests) {
      const startTime = performance.now();
      try {
        await transform(test.html);
        const duration = performance.now() - startTime;
        results.push({
          name: test.name,
          duration: duration.toFixed(2),
          status: 'success'
        });
      } catch (error) {
        results.push({
          name: test.name,
          duration: '失败',
          status: 'error',
          error: (error as Error).message
        });
      }
    }
    
    setTestResults(results);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🧪 性能测试</h2>
      <button 
        onClick={runTests}
        style={{
          background: '#0070f3',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '5px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        运行性能测试
      </button>

      {testResults.length > 0 && (
        <div>
          <h3>测试结果:</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>测试名称</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>耗时</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((result, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{result.name}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{result.duration}ms</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <span style={{ 
                      color: result.status === 'success' ? 'green' : 'red' 
                    }}>
                      {result.status === 'success' ? '✅' : '❌'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
