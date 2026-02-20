/**
 * 后台同步服务 - 本地优先架构
 * 
 * 负责将本地 IndexedDB 中的文件静默同步到云端
 * 用户可以先阅读本地版本，后台自动完成云端同步
 */

import { createClient } from '@/lib/supabase/client';
import { db, type SyncStatus } from '@/lib/db';

export interface SyncProgress {
  status: SyncStatus;
  progress: number; // 0-100
  error?: string;
}

export interface SyncResult {
  success: boolean;
  localId: string;
  cloudCollectionId?: string;
  cloudArticleId?: string;
  jobId?: string;
  error?: string;
}

/**
 * 同步本地书籍到云端
 * @param file 原始文件对象
 * @param localId 本地书籍 ID
 * @param userId 用户 ID
 * @param onProgress 进度回调（可选）
 */
export async function syncLocalBookToCloud(
  file: File,
  localId: string,
  userId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const updateProgress = (status: SyncStatus, progress: number, error?: string) => {
    const data: SyncProgress = { status, progress, error };
    onProgress?.(data);
    // 同时更新 IndexedDB
    return db.books.update(localId, { 
      syncStatus: status, 
      syncProgress: progress,
      ...(error && { syncError: error })
    });
  };

  try {
    // 1. 上传中
    await updateProgress('uploading', 10);

    const supabase = createClient();
    
    // 提取文件扩展名
    const fileExt = file.name.match(/\.[^.]+$/)?.[0] || '';
    
    // 清理文件名（保留扩展名）
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
    const sanitizedFileName = nameWithoutExt.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");
    const safeFileName = (sanitizedFileName || 'upload') + fileExt;
    
    const filePath = `${userId}/${Date.now()}_${safeFileName}`;

    // 2. 上传到 Supabase Storage
    await updateProgress('uploading', 30);
    
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`);
    }

    await updateProgress('uploading', 50);

    // 3. 触发后端导入解析
    await updateProgress('processing', 60);

    const res = await fetch('/api/import/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        originalName: file.name,
        fileType: file.type
      }),
    });

    await updateProgress('processing', 80);

    if (!res.ok) {
      let message = `导入失败 (${res.status})`;
      try {
        const errorData = await res.clone().json();
        message = errorData.error || errorData.message || message;
      } catch {
        try {
          const text = await res.text();
          if (text) message = text.slice(0, 300);
        } catch { }
      }
      throw new Error(message);
    }

    const data = await res.json();

    // 4. 同步完成
    await updateProgress('synced', 100);

    // 5. 更新云端 ID 关联和 jobId
    await db.books.update(localId, {
      syncStatus: 'synced',
      syncProgress: 100,
      cloudCollectionId: data.data.collection?.id,
      cloudArticleId: data.data.articles?.[0]?.id,
      jobId: data.data.jobId, // 保存 jobId
    });

    return {
      success: true,
      localId,
      cloudCollectionId: data.data.collection?.id,
      cloudArticleId: data.data.articles?.[0]?.id,
      jobId: data.data.jobId, // 返回 jobId 用于进度追踪
    };

  } catch (error: any) {
    const errorMessage = error.message || '同步失败';
    await updateProgress('error', 0, errorMessage);
    
    return {
      success: false,
      localId,
      error: errorMessage,
    };
  }
}

/**
 * 重试失败的同步
 * @param localId 本地书籍 ID
 * @param userId 用户 ID
 * @param file 原始文件（需要重新提供）
 */
export async function retrySync(
  localId: string,
  userId: string,
  file: File,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  // 重置状态
  await db.books.update(localId, {
    syncStatus: 'local',
    syncProgress: 0,
    syncError: undefined,
  });

  return syncLocalBookToCloud(file, localId, userId, onProgress);
}

/**
 * 获取本地书籍的同步状态
 */
export async function getSyncStatus(localId: string): Promise<SyncProgress | null> {
  const book = await db.books.get(localId);
  if (!book) return null;
  
  return {
    status: book.syncStatus,
    progress: book.syncProgress || 0,
    error: book.syncError,
  };
}

/**
 * 切换到云端版本阅读
 * 同步完成后，用户可以从本地阅读切换到云端阅读以获得 AI 功能
 */
export async function switchToCloudVersion(localId: string): Promise<{
  cloudCollectionId?: string;
  cloudArticleId?: string;
} | null> {
  const book = await db.books.get(localId);
  if (!book || book.syncStatus !== 'synced') {
    return null;
  }

  return {
    cloudCollectionId: book.cloudCollectionId,
    cloudArticleId: book.cloudArticleId,
  };
}
