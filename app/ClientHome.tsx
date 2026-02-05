"use client";
import { useEffect, useState } from "react";
import type { Article } from "@/lib/core/reading/articles.service";
import type { Collection } from "@/lib/core/reading/collections.service";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useConceptStore } from "@/lib/store/useConceptStore";
import { useHomeData } from "@/lib/hooks/home/useHomeData";

import { HomeLayout } from "@/app/components/home/HomeLayout";
import { HomeSidebar } from "@/app/components/home/HomeSidebar";
import { HomeContent } from "@/app/components/home/HomeContent";

interface ClientHomeProps {
  initialArticles?: Article[];
  initialCollections?: Collection[];
}

export default function ClientHome({ initialArticles, initialCollections }: ClientHomeProps) {
  const { isAuthenticated, fetchSession } = useAuthStore();
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

  // Initial Data Load
  useEffect(() => {
    fetchSession();
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
      />
    </HomeLayout>
  );
}
