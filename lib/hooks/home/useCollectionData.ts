import { useState, useCallback } from 'react';
import { Article } from '@/lib/core/reading/articles.service';
import { toast } from 'sonner';

export function useCollectionData() {
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Map<string, Article[]>>(new Map());
  const [loadingCollectionId, setLoadingCollectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleCollection = useCallback(async (collectionId: string) => {
    // Collapse if already expanded
    if (expandedCollectionId === collectionId) {
      setExpandedCollectionId(null);
      return;
    }

    setExpandedCollectionId(collectionId);
    setError(null);

    // Fetch if not already cached
    if (!expandedCollections.has(collectionId)) {
      setLoadingCollectionId(collectionId);
      try {
        const res = await fetch(`/api/collections/${collectionId}`);
        if (!res.ok) throw new Error("加载合集失败");
        const data = await res.json();

        if (!data.collection) throw new Error("合集数据缺失");

        const articles = data.collection.articles || [];
        
        setExpandedCollections(prev => new Map(prev).set(collectionId, articles));
        
        if (articles.length === 0) {
            toast.info("本书为空");
        }
      } catch (e: any) {
        console.error(e);
        setError("打开书籍失败");
        toast.error("打开书籍失败");
      } finally {
        setLoadingCollectionId(null);
      }
    }
  }, [expandedCollectionId, expandedCollections]);

  return {
    expandedCollectionId,
    toggleCollection,
    getCollectionArticles: (id: string) => expandedCollections.get(id),
    isLoading: (id: string) => loadingCollectionId === id,
    error
  };
}
