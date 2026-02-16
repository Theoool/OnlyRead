/**
 * 文件导入进度显示组件
 */

'use client';

import { useImportProgress, formatDuration, getProgressColor } from '@/lib/hooks/use-import-progress';

interface ImportProgressDisplayProps {
  jobId: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function ImportProgressDisplay({ 
  jobId, 
  onComplete, 
  onError 
}: ImportProgressDisplayProps) {
  const { progress, isLoading, error, isCompleted, isFailed, isProcessing } = useImportProgress({
    jobId,
    enabled: true,
    pollInterval: 2000,
    onComplete,
    onError,
  });

  if (!progress && isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">加载进度信息...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">获取进度失败</h3>
            <p className="mt-1 text-sm text-red-700">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const progressColor = getProgressColor(progress.status);
  const progressPercent = Math.min(100, Math.max(0, progress.progress));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      {/* 标题和状态 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {isProcessing && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
          )}
          {isCompleted && (
            <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {isFailed && (
            <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <h3 className="text-lg font-semibold text-gray-900">
            {progress.type === 'IMPORT_FILE' ? '文件导入' : '生成索引'}
          </h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(progress.status)}`}>
          {getStatusText(progress.status)}
        </span>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{progress.message}</span>
          <span className="text-sm font-medium text-gray-900">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* 详细信息 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">总文章数:</span>
          <span className="ml-2 font-medium text-gray-900">{progress.details.totalArticles}</span>
        </div>
        <div>
          <span className="text-gray-500">已处理:</span>
          <span className="ml-2 font-medium text-gray-900">{progress.details.processedArticles}</span>
        </div>
        {progress.details.failedArticles > 0 && (
          <div>
            <span className="text-gray-500">失败:</span>
            <span className="ml-2 font-medium text-red-600">{progress.details.failedArticles}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">耗时:</span>
          <span className="ml-2 font-medium text-gray-900">{formatDuration(progress.duration)}</span>
        </div>
      </div>
    </div>
  );
}

function getStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
      return '等待中';
    case 'PROCESSING':
      return '处理中';
    case 'COMPLETED':
      return '已完成';
    case 'FAILED':
      return '失败';
    default:
      return '未知';
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-gray-100 text-gray-800';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

