import { twMerge } from "tailwind-merge";
import { History, Library, Sparkles, Command } from "lucide-react";
import { Article } from "@/lib/core/reading/articles.service";
import { ArticleList } from "./ArticleList";
import { CollectionList } from "./CollectionList";

interface HomeContentProps {
  articles: Article[];
  isLoadingArticles: boolean;
  onLoadMoreArticles: () => void;
  hasMoreArticles: boolean;
  totalArticlesCount: number;

  collections: any[];
  isLoadingCollections: boolean;
  totalCollectionsCount: number;

  viewMode: 'articles' | 'collections';
  setViewMode: (mode: 'articles' | 'collections') => void;
}

export function HomeContent({
  articles,
  isLoadingArticles,
  onLoadMoreArticles,
  hasMoreArticles,
  totalArticlesCount,

  collections,
  isLoadingCollections,
  totalCollectionsCount,

  viewMode,
  setViewMode,
}: HomeContentProps) {
  return (
    <section className="w-full md:w-1/2 lg:w-[45%] bg-zinc-50 dark:bg-[#050505] flex flex-col relative">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-[#050505]/80 backdrop-blur z-10">
        <div className="flex items-center gap-4">
           <button 
              onClick={() => setViewMode('articles')}
              className={twMerge(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                viewMode === 'articles' ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600"
              )}
           >
             <History className="w-3 h-3" />
             文章
           </button>
           <button 
              onClick={() => setViewMode('collections')}
              className={twMerge(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                viewMode === 'collections' ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600"
              )}
           >
             <Library className="w-3 h-3" />
             书籍
           </button>
        </div>
        
        <div className="flex items-center gap-4">
            {/* QA Entry */}
            <a href="/qa" className="flex items-center gap-1 text-[10px] font-mono text-indigo-500 hover:text-indigo-600 transition-colors group">
                <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
                问答
            </a>

            {/* Search Link */}
            <a href="/search" className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-600 transition-colors">
                <Command className="w-3 h-3" />
                搜索
            </a>

            <span className="text-[10px] font-mono text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-4">
                {viewMode === 'articles' ? totalArticlesCount : totalCollectionsCount} 记录
            </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar relative">
        {viewMode === 'articles' ? (
          <ArticleList 
            articles={articles} 
            isLoading={isLoadingArticles}
            onLoadMore={onLoadMoreArticles}
            hasMore={hasMoreArticles}
          />
        ) : (
          <CollectionList 
            collections={collections} 
            isLoading={isLoadingCollections}
          />
        )}
        <div className="h-20" /> {/* Bottom spacer */}
      </div>
    </section>
  );
}
