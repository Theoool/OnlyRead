/**
 * Job 进度追踪 Hook
 * 
 * 用于追踪后台任务（如 AI 索引）的进度
 */

import { useState, useEffect } from 'react';

export interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  result?: any;
  error?: string;
}

export function useJobProgress(jobId?: string) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJobStatus(null);
      return;
    }

    setIsLoading(true);
    let isCancelled = false;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error('获取进度失败');
        
        const data = await res.json();
        
        if (!isCancelled) {
          setJobStatus(data.job);
          setIsLoading(false);
        }

        // 如果任务完成或失败，停止轮询
        if (data.job.status === 'COMPLETED' || data.job.status === 'FAILED') {
          return true; // 停止轮询
        }
        
        return false; // 继续轮询
      } catch (error) {
        console.error('Job progress fetch error:', error);
        if (!isCancelled) {
          setIsLoading(false);
        }
        return false;
      }
    };

    // 立即执行一次
    fetchProgress();

    // 设置轮询
    const interval = setInterval(async () => {
      const shouldStop = await fetchProgress();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000); // 每 2 秒轮询一次

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  return {
    jobStatus,
    isLoading,
    isProcessing: jobStatus?.status === 'PROCESSING' || jobStatus?.status === 'PENDING',
    isCompleted: jobStatus?.status === 'COMPLETED',
    isFailed: jobStatus?.status === 'FAILED',
    progress: jobStatus?.progress || 0,
  };
}

