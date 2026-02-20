import { useMemo, useState } from 'react';
import { useArticles } from '@/lib/hooks/use-articles';
import { useCollections } from '@/lib/hooks/use-collections';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Article } from '@/lib/core/reading/articles.service';
import { Collection } from '@/lib/core/reading/collections.service';

interface UseHomeDataProps {
  initialArticles?: Article[];
  initialCollections?: Collection[];
}

export function useHomeData({ initialArticles, initialCollections }: UseHomeDataProps = {}) {
  // Articles Data
  const { data: articlesData = { articles: [] }, isLoading: isLoadingArticles } = useArticles();
  const articles = articlesData.articles?.length > 0 ? articlesData.articles : (initialArticles || []);

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0));
  }, [articles]);

  // Pagination for articles
  const [displayLimit, setDisplayLimit] = useState(20);
  const displayedArticles = useMemo(() => sortedArticles.slice(0, displayLimit), [sortedArticles, displayLimit]);
  const loadMoreArticles = () => setDisplayLimit(prev => prev + 20);
  const hasMoreArticles = displayedArticles.length < sortedArticles.length;

 
  const { data: collections = [], isLoading: isLoadingCollections } = useCollections();
  const effectiveCollections = collections.length > 0 ? collections : (initialCollections || []);

  const localBooks = useLiveQuery(() => db.books.toArray()) || [];

  const sortedCollections = useMemo(() => {
    // 创建书名到书籍的映射
    const booksByTitle = new Map<string, any>();
    
    // 先处理远程书籍
    effectiveCollections.forEach((c) => {
      const normalizedTitle = c.title.trim().toLowerCase();
      booksByTitle.set(normalizedTitle, {
        ...c,
        isLocal: false,
        hasLocalCopy: false,
        localId: undefined,
        cloudId: c.id,
      });
    });
    
    // 再处理本地书籍
    localBooks.forEach((b) => {
      const normalizedTitle = b.title.trim().toLowerCase();
      const existing = booksByTitle.get(normalizedTitle);
      
      if (existing) {
        // 同名书籍存在，合并信息
        existing.hasLocalCopy = true;
        existing.localId = b.id;
        // 如果远程书籍更新时间早于本地，使用本地时间
        if (b.addedAt) {
          const localTime = typeof b.addedAt === 'number' ? b.addedAt : new Date(b.addedAt).getTime();
          const remoteTime = new Date(existing.updatedAt).getTime();
          if (!isNaN(localTime) && !isNaN(remoteTime) && localTime > remoteTime) {
            existing.updatedAt = new Date(localTime).toISOString();
          }
        }
      } else {
        // 纯本地书籍
        const addedTime = b.addedAt || Date.now();
        booksByTitle.set(normalizedTitle, {
          id: b.id,
          title: b.title,
          updatedAt: new Date(addedTime).toISOString(),
          _count: { articles: 1 },
          isLocal: true,
          hasLocalCopy: true,
          localId: b.id,
          cloudId: undefined,
          format: b.format
        });
      }
    });
    
    // 转换为数组并排序
    return Array.from(booksByTitle.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [effectiveCollections, localBooks]);

  return {
    articles: sortedArticles,
    displayedArticles,
    isLoadingArticles,
    loadMoreArticles,
    hasMoreArticles,
    totalArticlesCount: sortedArticles.length,
    
    collections: sortedCollections,
    isLoadingCollections,
    totalCollectionsCount: sortedCollections.length
  };
}
