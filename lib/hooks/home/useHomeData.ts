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

  // Collections Data
  const { data: collections = [], isLoading: isLoadingCollections } = useCollections();
  const effectiveCollections = collections.length > 0 ? collections : (initialCollections || []);

  const localBooks = useLiveQuery(() => db.books.toArray()) || [];

  const sortedCollections = useMemo(() => {
    const remote = effectiveCollections.map((c) => ({ ...c, isLocal: false }));
    const remoteIds = new Set(remote.map(c => c.id));
    
    // Identify remote collections that also exist locally
    const localIds = new Set(localBooks.map(b => b.id));
    const remoteWithLocalFlag = remote.map(c => ({
      ...c,
      hasLocalCopy: localIds.has(c.id)
    }));
    
    const local = localBooks
      .filter(b => !remoteIds.has(b.id))
      .map(b => ({
        id: b.id,
        title: b.title,
        updatedAt: new Date(b.addedAt).toISOString(),
        _count: { articles: 1 },
        isLocal: true,
        hasLocalCopy: true,
        format: b.format
      }));
    return [...remoteWithLocalFlag, ...local].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
