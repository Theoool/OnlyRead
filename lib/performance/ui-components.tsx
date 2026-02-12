/**
 * 性能监控UI组件
 * Performance Monitoring UI Components
 */

'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceMonitor, usePerformanceMonitor, PerformanceStats, AlertSeverity } from './monitor';

// 主监控面板组件
export function PerformanceDashboard() {
  const { metrics, getMetricStats, monitor } = usePerformanceMonitor();
  const [isExpanded, setIsExpanded] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('processing.time');

  // 设置告警处理器
  useEffect(() => {
    const alertHandler = (alert: any) => {
      setAlerts(prev => [...prev, {
        ...alert,
        id: Date.now()
      }]);
      
      // 5秒后自动清除告警
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alert.id));
      }, 5000);
    };

    monitor.addAlertHandler(alertHandler);

    // 清理历史数据
    const interval = setInterval(() => {
      setAlerts(prev => prev.filter(alert => 
        Date.now() - alert.timestamp < 30000
      ));
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [monitor]);

  // 获取可用的指标名称
  const metricNames = Object.keys(metrics);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* 告警通知 */}
      <div className="mb-2 space-y-2">
        {alerts.map(alert => (
          <AlertNotification 
            key={alert.id}
            alert={alert}
            onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
          />
        ))}
      </div>

      {/* 主监控面板 */}
      <div className={`bg-white rounded-lg shadow-xl border transition-all duration-300 ${
        isExpanded ? 'w-96 p-4' : 'w-12 h-12 p-2'
      }`}>
        {!isExpanded ? (
          // 折叠状态 - 快速概览
          <button 
            onClick={() => setIsExpanded(true)}
            className="w-full h-full flex items-center justify-center hover:bg-gray-100 rounded"
          >
            <div className="text-2xl">📊</div>
          </button>
        ) : (
          // 展开状态 - 详细信息
          <div>
            {/* 头部 */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">性能监控</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMetric('')}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                >
                  刷新
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 指标选择器 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择指标
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              >
                <option value="">全部指标</option>
                {metricNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* 指标详情 */}
            {selectedMetric ? (
              <MetricDetail 
                metricName={selectedMetric} 
                stats={metrics[selectedMetric]} 
              />
            ) : (
              <AllMetricsSummary metrics={metrics} />
            )}

            {/* 操作按钮 */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => monitor.clearMetrics()}
                className="flex-1 py-2 px-3 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                清除数据
              </button>
              <button
                onClick={() => {
                  const data = monitor.exportData();
                  console.log('导出的性能数据:', data);
                }}
                className="flex-1 py-2 px-3 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
              >
                导出数据
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 告警通知组件
function AlertNotification({ alert, onClose }: { alert: any; onClose: () => void }) {
  const getAlertColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`${getAlertColor(alert.severity)} text-white p-3 rounded-lg shadow-lg max-w-md`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{alert.metric.name} 告警</div>
          <div className="text-sm opacity-90">
            当前值: {alert.metric.value}, 阈值: {alert.threshold}
          </div>
        </div>
        <button 
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// 单个指标详情组件
function MetricDetail({ metricName, stats }: { metricName: string; stats: PerformanceStats }) {
  if (!stats) {
    return <div className="text-gray-500 text-center py-4">暂无数据</div>;
  }

  const formatValue = (value: number) => {
    if (metricName.includes('time') || metricName.includes('duration')) {
      return `${value.toFixed(2)}ms`;
    }
    if (metricName.includes('memory')) {
      return `${value.toFixed(1)}MB`;
    }
    if (metricName.includes('rate') || metricName.includes('percent')) {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <StatCard label="最小值" value={formatValue(stats.min)} />
        <StatCard label="最大值" value={formatValue(stats.max)} />
        <StatCard label="平均值" value={formatValue(stats.avg)} />
        <StatCard label="中位数" value={formatValue(stats.median)} />
        <StatCard label="95th" value={formatValue(stats.p95)} />
        <StatCard label="99th" value={formatValue(stats.p99)} />
      </div>
      
      <div className="pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-600">
          样本数量: {stats.count}
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 p-2 rounded">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
    </div>
  );
}

// 所有指标摘要组件
function AllMetricsSummary({ metrics }: { metrics: Record<string, PerformanceStats> }) {
  const metricEntries = Object.entries(metrics);
  
  if (metricEntries.length === 0) {
    return <div className="text-gray-500 text-center py-4">暂无性能数据</div>;
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {metricEntries.map(([name, stats]) => (
        <div key={name} className="border border-gray-200 rounded p-2">
          <div className="font-medium text-sm text-gray-800 truncate">{name}</div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>平均: {stats.avg.toFixed(2)}</span>
            <span>次数: {stats.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 实时图表组件（简化版）
export function RealtimeChart({ metricName, height = 100 }: { metricName: string; height?: number }) {
  const { monitor } = usePerformanceMonitor();
  const [dataPoints, setDataPoints] = useState<number[]>([]);

  useEffect(() => {
    const observer = (metric: any) => {
      if (metric.name === metricName) {
        setDataPoints(prev => {
          const newPoints = [...prev, metric.value];
          return newPoints.slice(-50); // 保持最近50个数据点
        });
      }
    };

    monitor.addObserver(observer);
    return () => monitor.removeObserver(observer);
  }, [monitor, metricName]);

  if (dataPoints.length === 0) {
    return (
      <div className="bg-gray-100 rounded" style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          等待数据...
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...dataPoints);
  const minValue = Math.min(...dataPoints);
  const range = maxValue - minValue || 1;

  return (
    <div className="relative bg-gray-50 rounded overflow-hidden" style={{ height }}>
      <svg width="100%" height="100%" className="absolute inset-0">
        {dataPoints.map((value, index) => {
          const x = (index / (dataPoints.length - 1)) * 100;
          const y = 100 - ((value - minValue) / range) * 100;
          
          return (
            <circle
              key={index}
              cx={`${x}%`}
              cy={`${y}%`}
              r="2"
              fill="#3b82f6"
              className="opacity-70"
            />
          );
        })}
        
        {/* 连接线 */}
        {dataPoints.slice(0, -1).map((value, index) => {
          const x1 = (index / (dataPoints.length - 1)) * 100;
          const y1 = 100 - ((value - minValue) / range) * 100;
          const x2 = ((index + 1) / (dataPoints.length - 1)) * 100;
          const y2 = 100 - ((dataPoints[index + 1] - minValue) / range) * 100;
          
          return (
            <line
              key={`line-${index}`}
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke="#3b82f6"
              strokeWidth="1"
              className="opacity-50"
            />
          );
        })}
      </svg>
      
      <div className="absolute bottom-1 left-1 text-xs text-gray-600">
        最近值: {dataPoints[dataPoints.length - 1]?.toFixed(2)}
      </div>
    </div>
  );
}

// 性能小部件组件
export function PerformanceWidget({ metricName }: { metricName: string }) {
  const { getMetricStats } = usePerformanceMonitor();
  const stats = getMetricStats(metricName);

  if (!stats) {
    return (
      <div className="bg-white p-3 rounded-lg border shadow-sm">
        <div className="text-gray-500 text-center">暂无数据</div>
      </div>
    );
  }

  const getValueDisplay = () => {
    if (metricName.includes('time')) {
      return `${stats.avg.toFixed(0)}ms`;
    }
    if (metricName.includes('memory')) {
      return `${stats.avg.toFixed(1)}MB`;
    }
    if (metricName.includes('rate')) {
      return `${stats.avg.toFixed(1)}%`;
    }
    return stats.avg.toFixed(0);
  };

  const getStatusColor = () => {
    if (metricName.includes('error') && stats.avg > 0) return 'text-red-600';
    if (metricName.includes('time') && stats.avg > 1000) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white p-3 rounded-lg border shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
        {metricName}
      </div>
      <div className={`text-xl font-bold ${getStatusColor()}`}>
        {getValueDisplay()}
      </div>
      <div className="text-xs text-gray-400 mt-1">
        样本: {stats.count}
      </div>
    </div>
  );
}
