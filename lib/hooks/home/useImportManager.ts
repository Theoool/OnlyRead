/**
 * 统一导入管理 Hook
 * 
 * 整合所有导入方式，提供统一的状态管理和错误处理
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { importUrl } from '@/app/actions/import';
import { saveArticle } from '@/app/actions/article';
import { truncate } from '@/lib/utils';
import { Article } from '@/lib/core/reading/articles.service';
import { db, type LocalBook } from '@/lib/db';
import { syncLocalBookToCloud } from '@/lib/import/background-sync';
import { IdManager } from '@/lib/import/id-manager';

interface UseImportManagerOptions {
  userId?: string;
  onSuccess?: (result: ImportResult) => void;
  onLocalReady?: (localId: string) => void;
}

export interface ImportResult {
  type: 'file' | 'url' | 'text';
  localId?: string;
  cloudId?: string;
  jobId?: string;
  mode: 'articles' | 'collections';
}

export function useImportManager({ userId, onSuccess, onLocalReady }: UseImportManagerOptions) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [jobId, setJobId] = useState<string>();

  /**
   * 统一的文件导入处理
   */
  const importFile = useCallback(async (file: File) => {
    if (!userId) {
      toast.error("请先登录以上传文件");
      return;
    }

    if (isLoading) {
      toast.error("请等待当前导入完成");
      return;
    }

    setIsLoading(true);
    setError(undefined);
    setJobId(undefined);

    try {
      // 1. 验证文件类型
      const isEpub = file.name.toLowerCase().endsWith('.epub');
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isMd = file.name.toLowerCase().endsWith('.md');
      const isTxt = file.name.toLowerCase().endsWith('.txt');

      if (!isEpub && !isPdf && !isMd && !isTxt) {
        throw new Error("不支持的文件格式。请上传 .epub, .pdf, .md, 或 .txt");
      }

      // 2. 生成本地 ID
      const localId = IdManager.generateLocalId();

      // 3. 保存到 IndexedDB
      const fileData = await file.arrayBuffer();
      const localBook: LocalBook = {
        id: localId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        fileData: fileData,
        format: isEpub ? 'epub' : isPdf ? 'pdf' : isMd ? 'md' : 'txt',
        addedAt: Date.now(),
        syncStatus: 'local',
      };

      await db.books.add(localBook);

      // 4. 立即通知可以本地阅读
      onLocalReady?.(localId);
      toast.success("文件已就绪", { description: "正在打开阅读器..." });

      // 5. 后台同步到云端
      performBackgroundSync(file, localId, userId);

    } catch (err: any) {
      console.error('File import error:', err);
      setError(err.message || "文件导入失败");
      toast.error("导入失败", { description: err.message });
      setIsLoading(false);
    }
  }, [userId, onLocalReady, isLoading]);

  /**
   * 后台同步逻辑
   */
  const performBackgroundSync = async (
    file: File,
    localId: string,
    userId: string
  ) => {
    try {
      const result = await syncLocalBookToCloud(file, localId, userId);

      if (result.success) {
        // 设置 jobId 用于进度显示
        if (result.jobId) {
          setJobId(result.jobId);
        }

        // 关联 ID
        await IdManager.linkIds(localId, {
          articleId: result.cloudArticleId,
          collectionId: result.cloudCollectionId,
        });

        // 刷新查询
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['articles'] }),
          queryClient.invalidateQueries({ queryKey: ['collections'] })
        ]);

        const mode = result.cloudCollectionId ? 'collections' : 'articles';
        onSuccess?.({
          type: 'file',
          localId,
          cloudId: result.cloudCollectionId || result.cloudArticleId,
          jobId: result.jobId,
          mode,
        });

        toast.success("已同步到云端", { 
          description: result.cloudCollectionId ? "AI 功能已就绪" : undefined 
        });
      } else {
        throw new Error(result.error || '同步失败');
      }
    } catch (err: any) {
      console.error('Background sync error:', err);
      setError(err.message || '云端同步失败');
      toast.error("云端同步失败", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 统一的 URL 导入处理
   */
  const importFromUrl = useCallback(async (url: string) => {
    if (isLoading) {
      toast.error("请等待当前导入完成");
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      await importUrl(url);
      await queryClient.invalidateQueries({ queryKey: ['articles'] });

      onSuccess?.({
        type: 'url',
        mode: 'articles',
      });

      toast.success("链接导入成功");
    } catch (err: any) {
      console.error('URL import error:', err);
      const errorMsg = err.message || "该网站不支持，请手动复制粘贴文本";
      setError(errorMsg);
      toast.error("导入失败", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [queryClient, onSuccess, isLoading]);

  /**
   * 统一的文本导入处理
   */
  const importFromText = useCallback(async (text: string) => {
    if (isLoading) {
      toast.error("请等待当前导入完成");
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const isMd = /^(#|\- |\* |```|\[.+\]\(.+\)|> )/m.test(text);
      const article: Article = {
        id: `pasted-text-${Date.now()}`,
        title: truncate(text, 40),
        domain: "手动粘贴",
        content: text,
        progress: 0,
        lastRead: Date.now(),
        type: isMd ? 'markdown' : 'text',
      };

      const res = await saveArticle(article);
      if (!res.success) throw new Error('保存失败');

      await queryClient.invalidateQueries({ queryKey: ['articles'] });

      onSuccess?.({
        type: 'text',
        cloudId: article.id,
        mode: 'articles',
      });

      toast.success("文本保存成功");
    } catch (err: any) {
      console.error('Text import error:', err);
      const errorMsg = err.message || "保存失败，请重试";
      setError(errorMsg);
      toast.error("保存失败", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [queryClient, onSuccess, isLoading]);

  /**
   * 重试失败的导入
   */
  const retry = useCallback(async (localId: string, file: File) => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(undefined);
    setJobId(undefined);
    
    await performBackgroundSync(file, localId, userId);
  }, [userId]);

  return {
    // 导入方法
    importFile,
    importFromUrl,
    importFromText,
    retry,
    
    // 状态
    isLoading,
    error,
    jobId,
    
    // 辅助方法
    reset: () => {
      setIsLoading(false);
      setError(undefined);
      setJobId(undefined);
    },
  };
}

