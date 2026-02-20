import { twMerge } from "tailwind-merge";
import { History, Library, Sparkles, Command, GraduationCap } from "lucide-react";
import { Article } from "@/lib/core/reading/articles.service";
import { ArticleList } from "./ArticleList";
import { CollectionList } from "./CollectionList";
import { useIsMobile } from "@/lib/hooks/use-device";

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
  onRetrySync?: (localId: string) => void;
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
  onRetrySync,
}: HomeContentProps) {
  const isMobile = useIsMobile();

  return (
    <section className={twMerge(
      "w-full md:w-1/2 lg:w-[45%] bg-zinc-50 dark:bg-[#050505] flex flex-col relative",
      isMobile ? "h-full overflow-hidden" : ""
    )}>
      <div className={twMerge(
        "border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between bg-zinc-50/80 dark:bg-[#050505]/80 backdrop-blur z-10",
        isMobile ? "p-4 gap-3" : "p-6 gap-4"
      )}>
        <div className={twMerge(
          "flex items-center",
          isMobile ? "gap-2" : "gap-4"
        )}>
           <button 
              onClick={() => setViewMode('articles')}
              className={twMerge(
                "flex items-center justify-center gap-2 font-bold uppercase tracking-widest transition-all touch-manipulation",
                isMobile 
                  ? "min-h-[48px] px-5 py-3 rounded-xl text-sm" 
                  : "px-0 py-0 rounded-none text-xs",
                viewMode === 'articles' 
                  ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200/70 dark:bg-zinc-800/70" 
                  : "text-zinc-400 hover:text-zinc-600 bg-transparent active:scale-95"
              )}
           >
             <History className={twMerge(isMobile ? "w-5 h-5" : "w-3 h-3")} />
             <span>文章</span>
           </button>
           <button 
              onClick={() => setViewMode('collections')}
              className={twMerge(
                "flex items-center justify-center gap-2 font-bold uppercase tracking-widest transition-all touch-manipulation",
                isMobile 
                  ? "min-h-[48px] px-5 py-3 rounded-xl text-sm" 
                  : "px-0 py-0 rounded-none text-xs",
                viewMode === 'collections' 
                  ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200/70 dark:bg-zinc-800/70" 
                  : "text-zinc-400 hover:text-zinc-600 bg-transparent active:scale-95"
              )}
           >
             <Library className={twMerge(isMobile ? "w-5 h-5" : "w-3 h-3")} />
             <span>书籍</span>
           </button>
           {isMobile && (
              <span className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 rounded-lg">
                {viewMode === 'articles' ? totalArticlesCount : totalCollectionsCount}
              </span>
            )}

        </div>
        
    
      </div>

      <div className={twMerge(
        "flex-1 overflow-y-auto no-scrollbar relative",
        isMobile ? "p-4 space-y-3" : "p-4 space-y-2"
      )}>
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
            onRetrySync={onRetrySync}
          />
        )}
        <div className={twMerge(isMobile ? "h-24" : "h-20")} /> {/* Bottom spacer */}
      </div>
    </section>
  );
}
