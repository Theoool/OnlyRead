"use client";
import { useEffect, useState, useCallback } from "react";
import type { Article } from "@/lib/core/reading/articles.service";
import type { Collection } from "@/lib/core/reading/collections.service";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useConceptStore } from "@/lib/store/useConceptStore";
import { useHomeData } from "@/lib/hooks/home/useHomeData";
import { useImportManager } from "@/lib/hooks/home/useImportManager";
import { db } from "@/lib/db";
import { toast } from "sonner";

import { HomeLayout } from "@/app/components/home/HomeLayout";
import { HomeSidebar } from "@/app/components/home/HomeSidebar";
import { HomeContent } from "@/app/components/home/HomeContent";

interface ClientHomeProps {
  initialArticles?: Article[];
  initialCollections?: Collection[];
}

export default function ClientHome({ initialArticles, initialCollections }: ClientHomeProps) {
  const { isAuthenticated, fetchSession, user } = useAuthStore();
  const { loadConcepts } = useConceptStore();
  const [viewMode, setViewMode] = useState<'articles' | 'collections'>('articles');

  const {
    articles,
    displayedArticles,
    isLoadingArticles,
    loadMoreArticles,
    hasMoreArticles,
    totalArticlesCount,
    
    collections,
    isLoadingCollections,
    totalCollectionsCount
  } = useHomeData({ initialArticles, initialCollections });

  // 重试同步逻辑
  const { retry } = useImportManager({ userId: user?.id });

  const handleRetrySync = useCallback(async (localId: string) => {
    try {
      // 从 IndexedDB 获取书籍信息
      const book = await db.books.get(localId);
      if (!book) {
        toast.error("未找到本地文件");
        return;
      }

      // 重新创建 File 对象
      const file = new File([book.fileData], book.title, {
        type: book.format === 'epub' ? 'application/epub+zip' : 
              book.format === 'pdf' ? 'application/pdf' :
              book.format === 'md' ? 'text/markdown' : 'text/plain'
      });

      toast.info("开始重新同步...");
      await retry(localId, file);
    } catch (error) {
      console.error('Retry sync error:', error);
      toast.error("重试失败");
    }
  }, [retry]);

  // Initial Data Load with debouncing
  useEffect(() => {
    // 添加防抖逻辑，避免频繁检查
    const timer = setTimeout(() => {
      fetchSession();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadConcepts();
    }
  }, [isAuthenticated]);

  return (
    <HomeLayout>
      <HomeSidebar 
        onSuccess={(mode) => setViewMode(mode)} 
      />
      <HomeContent 
        articles={displayedArticles}
        isLoadingArticles={isLoadingArticles}
        onLoadMoreArticles={loadMoreArticles}
        hasMoreArticles={hasMoreArticles}
        totalArticlesCount={totalArticlesCount}

        collections={collections}
        isLoadingCollections={isLoadingCollections}
        totalCollectionsCount={totalCollectionsCount}

        viewMode={viewMode}
        setViewMode={setViewMode}
        onRetrySync={handleRetrySync}
      />
    </HomeLayout>
  );
}
