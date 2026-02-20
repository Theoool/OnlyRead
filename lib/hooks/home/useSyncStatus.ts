/**
 * 同步状态管理 Hook
 * 
 * 整合本地书籍的同步状态和 Job 进度
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useJobProgress } from './useJobProgress';

export function useSyncStatus(localId?: string) {
  // 从 IndexedDB 获取书籍信息
  const book = useLiveQuery(
    () => localId ? db.books.get(localId) : Promise.resolve(null),
    [localId]
  );

  // 追踪 Job 进度
  const { jobStatus, isProcessing, progress: jobProgress } = useJobProgress(book?.jobId);

  // 计算综合进度
  const getOverallProgress = () => {
    if (!book) return 0;
    
    // 如果有 Job 在处理，使用 Job 进度
    if (isProcessing && jobProgress > 0) {
      return jobProgress;
    }
    
    // 否则使用同步进度
    return book.syncProgress || 0;
  };

  // 获取状态描述
  const getStatusText = () => {
    if (!book) return '';
    
    switch (book.syncStatus) {
      case 'local':
        return '本地';
      case 'uploading':
        return '上传中';
      case 'processing':
        if (isProcessing) {
          return 'AI 处理中';
        }
        return '处理中';
      case 'synced':
        return '已同步';
      case 'error':
        return '同步失败';
      default:
        return '';
    }
  };

  return {
    book,
    syncStatus: book?.syncStatus || 'local',
    syncProgress: getOverallProgress(),
    statusText: getStatusText(),
    isSynced: book?.syncStatus === 'synced',
    isError: book?.syncStatus === 'error',
    isSyncing: book?.syncStatus === 'uploading' || book?.syncStatus === 'processing',
    cloudArticleId: book?.cloudArticleId,
    cloudCollectionId: book?.cloudCollectionId,
    jobStatus,
  };
}

