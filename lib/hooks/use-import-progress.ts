/**
 * 文件导入进度 Hook
 * 用于轮询和显示导入进度
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ImportProgress {
  jobId: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  createdAt: string;
  updatedAt: string;
  duration: number;
  details: {
    totalArticles: number;
    processedArticles: number;
    failedArticles: number;
    source: string;
  };
  message: string;
}

export interface UseImportProgressOptions {
  jobId?: string;
  enabled?: boolean;
  pollInterval?: number; // 轮询间隔（毫秒）
  onComplete?: (progress: ImportProgress) => void;
  onError?: (error: Error) => void;
}

export function useImportProgress(options: UseImportProgressOptions) {
  const {
    jobId,
    enabled = true,
    pollInterval = 2000, // 默认2秒轮询一次
    onComplete,
    onError,
  } = options;

  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  const fetchProgress = useCallback(async () => {
    if (!jobId || !enabled || completedRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/import/progress?jobId=${jobId}`);
      
      if (!response.ok) {
        throw new Error(`获取进度失败: ${response.statusText}`);
      }

      const data = await response.json();
      const progressData = data.data as ImportProgress;
      
      setProgress(progressData);
      setError(null);

      // 如果任务完成或失败，停止轮询
      if (progressData.status === 'COMPLETED') {
        completedRef.current = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onComplete?.(progressData);
      } else if (progressData.status === 'FAILED') {
        completedRef.current = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const err = new Error(progressData.message);
        setError(err);
        onError?.(err);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      
      // 出错时停止轮询
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  }, [jobId, enabled, onComplete, onError]);

  // 开始轮询
  useEffect(() => {
    if (!jobId || !enabled) {
      return;
    }

    // 立即获取一次
    fetchProgress();

    // 设置定时轮询
    intervalRef.current = setInterval(fetchProgress, pollInterval);

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, enabled, pollInterval, fetchProgress]);

  // 手动刷新
  const refresh = useCallback(() => {
    completedRef.current = false;
    fetchProgress();
  }, [fetchProgress]);

  // 停止轮询
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    progress,
    isLoading,
    error,
    refresh,
    stop,
    isCompleted: progress?.status === 'COMPLETED',
    isFailed: progress?.status === 'FAILED',
    isProcessing: progress?.status === 'PROCESSING' || progress?.status === 'PENDING',
  };
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 获取进度条颜色
 */
export function getProgressColor(status: ImportProgress['status']): string {
  switch (status) {
    case 'PENDING':
      return 'bg-gray-500';
    case 'PROCESSING':
      return 'bg-blue-500';
    case 'COMPLETED':
      return 'bg-green-500';
    case 'FAILED':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

