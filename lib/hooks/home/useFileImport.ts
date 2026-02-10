import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { importUrl } from '@/app/actions/import';
import { saveArticle } from '@/app/actions/article';
import { truncate } from '@/lib/utils';
import { Article } from '@/lib/core/reading/articles.service';
import { db, type LocalBook } from '@/lib/db';
import { syncLocalBookToCloud } from '@/lib/import/background-sync';

interface UseFileImportOptions {
  userId?: string;
  onSuccess?: (mode: 'articles' | 'collections') => void;
  onLocalReady?: (localId: string) => void; // 本地就绪回调，用于立即跳转
}

export function useFileImport({ userId, onSuccess, onLocalReady }: UseFileImportOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const handleFile = useCallback(async (file: File) => {
    if (!userId) {
      setError("请先登录以上传文件");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. 检查文件类型
      const isEpub = file.name.toLowerCase().endsWith('.epub');
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isMd = file.name.toLowerCase().endsWith('.md');
      const isTxt = file.name.toLowerCase().endsWith('.txt');

      if (!isEpub && !isPdf && !isMd && !isTxt) {
        throw new Error("不支持的文件格式。请上传 .epub, .pdf, .md, 或 .txt");
      }

      // 2. 【本地优先】立即保存到 IndexedDB
      const localId = crypto.randomUUID();
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
      
      // 3. 立即通知调用方可以跳转阅读（瞬间响应）
      onLocalReady?.(localId);
      toast.success("文件已就绪", { description: "正在打开阅读器..." });

      // 4. 【后台同步】静默上传到云端
      performBackgroundUpload(file, localId, userId);

    } catch (err: any) {
      console.error('File handling error:', err);
      setError(err.message || "文件处理失败");
      setLoading(false);
    }
  }, [userId, onLocalReady]);

  // 后台同步逻辑 - 使用 background-sync 服务
  const performBackgroundUpload = async (
    file: File, 
    localId: string, 
    userId: string
  ) => {
    const result = await syncLocalBookToCloud(
      file,
      localId,
      userId,
      (progress) => {
        // 可选：这里可以添加实时进度回调
        console.log(`[Sync ${localId}] ${progress.status}: ${progress.progress}%`);
      }
    );

    if (result.success) {
      // 刷新远程数据
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['articles'] }),
        queryClient.invalidateQueries({ queryKey: ['collections'] })
      ]);

      // 静默通知用户同步完成
      if (result.cloudCollectionId) {
        onSuccess?.('collections');
        toast.success("已同步到云端", { description: "AI 功能已就绪" });
      } else {
        onSuccess?.('articles');
        toast.success("已同步到云端");
      }
    } else {
      toast.error("云端同步失败", { description: result.error });
    }

    setLoading(false);
  };

  const handleUrlImport = useCallback(async (url: string) => {
    setLoading(true);
    setError("");
    try {
      await importUrl(url);
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      onSuccess?.('articles');
      toast.success("链接导入成功");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "该网站不支持，请手动复制粘贴文本");
    } finally {
      setLoading(false);
    }
  }, [queryClient, onSuccess]);

  const handleTextPaste = useCallback(async (text: string) => {
    setLoading(true);
    setError("");
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
      if (!res.success) throw new Error('Save failed');

      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      onSuccess?.('articles');
      toast.success("文本保存成功");
    } catch (err: any) {
      console.error(err);
      setError("保存失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [queryClient, onSuccess]);

  return {
    handleFile,
    handleUrlImport,
    handleTextPaste,
    loading,
    error,
    setError
  };
}
