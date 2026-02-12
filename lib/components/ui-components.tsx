/**
 * UI Components for MD Transformation
 * MD 转换的 UI 组件
 */

'use client';

import React, { useState } from 'react';
import { useComponentBasedTransformer } from '../components/core-components';

// 转换器主界面组件
export function MDTransformerUI() {
  const [inputHTML, setInputHTML] = useState('');
  const [result, setResult] = useState<any>(null);
  const { transform, isProcessing, getStats } = useComponentBasedTransformer();

  const handleTransform = async () => {
    if (!inputHTML.trim()) return;
    
    try {
      const output = await transform({ html: inputHTML });
      setResult(output);
    } catch (error) {
      console.error('转换失败:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🧩 组件化 MD 转换器</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>输入 HTML</h2>
        <textarea
          value={inputHTML}
          onChange={(e) => setInputHTML(e.target.value)}
          placeholder="在此输入 HTML 内容..."
          style={{
            width: '100%',
            height: '200px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}
        />
      </div>

      <button
        onClick={handleTransform}
        disabled={isProcessing || !inputHTML.trim()}
        style={{
          background: '#0070f3',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '5px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '16px'
        }}
      >
        {isProcessing ? '处理中...' : '转换'}
      </button>

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h2>转换结果</h2>
          
          <div style={{ 
            border: '1px solid #ddd', 
            borderRadius: '5px', 
            padding: '15px',
            marginBottom: '15px'
          }}>
            <h3>Markdown 输出</h3>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '3px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {result.markdown || '无内容'}
            </pre>
          </div>

          {result.images && result.images.length > 0 && (
            <div style={{ 
              border: '1px solid #ddd', 
              borderRadius: '5px', 
              padding: '15px',
              marginBottom: '15px'
            }}>
              <h3>提取的图片 ({result.images.length}张)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {result.images.map((src: string, index: number) => (
                  <img 
                    key={index}
                    src={src} 
                    alt={`提取图片 ${index + 1}`}
                    style={{ maxWidth: '100px', maxHeight: '100px', border: '1px solid #eee' }}
                  />
                ))}
              </div>
            </div>
          )}

          {result.toc && result.toc.length > 0 && (
            <div style={{ 
              border: '1px solid #ddd', 
              borderRadius: '5px', 
              padding: '15px'
            }}>
              <h3>目录结构</h3>
              <ul>
                {result.toc.map((item: any, index: number) => (
                  <li key={index} style={{ marginLeft: `${(item.level - 1) * 20}px` }}>
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 组件状态显示 */}
      <ComponentStats stats={getStats()} />
    </div>
  );
}

// 组件状态监控组件
function ComponentStats({ stats }: { stats: any }) {
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '15px', 
      borderRadius: '8px',
      fontSize: '12px',
      minWidth: '200px'
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>🔧 组件状态</h4>
      <div>处理状态: {stats.isProcessing ? '工作中' : '空闲'}</div>
      <div style={{ marginTop: '10px' }}>
        <strong>已加载组件:</strong>
        <ul style={{ margin: '5px 0 0 0', paddingLeft: '15px' }}>
          {stats.components.map((comp: any, index: number) => (
            <li key={index}>{comp.name} (v{comp.version})</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// 性能监控面板
export function PerformancePanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [metrics, setMetrics] = React.useState({
    processingTime: 0,
    memoryUsage: 0,
    cacheHits: 0
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      // 模拟性能数据收集
      setMetrics({
        processingTime: Math.random() * 100,
        memoryUsage: Math.random() * 50,
        cacheHits: Math.floor(Math.random() * 100)
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          background: '#ff6b6b',
          color: 'white',
          border: 'none',
          padding: '10px 15px',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        📊 性能
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000,
      minWidth: '250px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>📊 性能监控</h3>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>处理时间: </label>
        <span>{metrics.processingTime.toFixed(2)}ms</span>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>内存使用: </label>
        <span>{metrics.memoryUsage.toFixed(1)}MB</span>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>缓存命中: </label>
        <span>{metrics.cacheHits} 次</span>
      </div>

      <button
        onClick={() => setMetrics({ processingTime: 0, memoryUsage: 0, cacheHits: 0 })}
        style={{
          width: '100%',
          padding: '8px',
          background: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        重置统计
      </button>
    </div>
  );
}

// 配置管理组件
export function ConfigManagerUI() {
  const [config, setConfig] = React.useState({
    useComponents: true,
    cacheEnabled: true,
    logLevel: 'info'
  });

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>⚙️ 系统配置</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            checked={config.useComponents}
            onChange={(e) => updateConfig('useComponents', e.target.checked)}
          />
          使用组件化架构
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            checked={config.cacheEnabled}
            onChange={(e) => updateConfig('cacheEnabled', e.target.checked)}
          />
          启用缓存
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          日志级别:
          <select
            value={config.logLevel}
            onChange={(e) => updateConfig('logLevel', e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
      </div>

      <button
        onClick={() => console.log('配置已保存:', config)}
        style={{
          background: '#28a745',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        保存配置
      </button>
    </div>
  );
}
