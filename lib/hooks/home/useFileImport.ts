import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { importUrl } from '@/app/actions/import';
import { saveArticle } from '@/app/actions/article';
import { truncate } from '@/lib/utils';
import { Article } from '@/lib/core/reading/articles.service';

interface UseFileImportOptions {
  userId?: string;
  onSuccess?: (mode: 'articles' | 'collections') => void;
}

export function useFileImport({ userId, onSuccess }: UseFileImportOptions) {
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
      // 1. Check file type
      const isEpub = file.name.toLowerCase().endsWith('.epub');
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isMd = file.name.toLowerCase().endsWith('.md');
      const isTxt = file.name.toLowerCase().endsWith('.txt');

      if (!isEpub && !isPdf && !isMd && !isTxt) {
        throw new Error("不支持的文件格式。请上传 .epub, .pdf, .md, 或 .txt");
      }

      const performBackgroundUpload = async () => {
        try {
          const supabase = createClient();
          const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");
          const filePath = `${userId}/${Date.now()}_${sanitizedFileName}`;

          // A. Upload to Supabase
          const { error: uploadError } = await supabase.storage
            .from('files')
            .upload(filePath, file);

          if (uploadError) {
            throw new Error(`上传失败: ${uploadError.message}`);
          }

          // B. Trigger Backend Import
          const res = await fetch('/api/import/file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath,
              originalName: file.name,
              fileType: file.type
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Process failed');
          }

          const data = await res.json();

          // C. Refresh remote data
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['articles'] }),
            queryClient.invalidateQueries({ queryKey: ['collections'] })
          ]);

          // D. Feedback
          if (data.data.collection) {
            onSuccess?.('collections');
            toast.success("书籍导入成功", { description: "已准备好阅读和 AI 分析" });
          } else {
            onSuccess?.('articles');
            toast.success("文章导入成功");
          }

        } catch (bgError: any) {
          console.error("[Background] Upload failed", bgError);
          toast.error("导入失败", { description: bgError.message });
        } finally {
            setLoading(false);
        }
      };

      await performBackgroundUpload();

    } catch (err: any) {
      console.error('File handling error:', err);
      setError(err.message || "文件处理失败");
      setLoading(false);
    }
  }, [userId, queryClient, onSuccess]);

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
