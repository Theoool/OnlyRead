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
  const isMobile = useIsMobile();

  return (
    <section className="w-full md:w-1/2 lg:w-[45%] bg-zinc-50 dark:bg-[#050505] flex flex-col relative">
      <div className="p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 bg-zinc-50/80 dark:bg-[#050505]/80 backdrop-blur z-10">
        <div className="flex items-center gap-3 md:gap-4">
           <button 
              onClick={() => setViewMode('articles')}
              className={twMerge(
                "flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all touch-manipulation active:scale-95",
                isMobile ? "min-h-[44px] px-4 py-2.5 rounded-xl" : "px-0 py-0 rounded-none",
                viewMode === 'articles' 
                  ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200/70 dark:bg-zinc-800/70" 
                  : "text-zinc-400 hover:text-zinc-600 bg-transparent"
              )}
           >
             <History className={twMerge(isMobile ? "w-4 h-4" : "w-3 h-3")} />
             <span>文章</span>
           </button>
           <button 
              onClick={() => setViewMode('collections')}
              className={twMerge(
                "flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all touch-manipulation active:scale-95",
                isMobile ? "min-h-[44px] px-4 py-2.5 rounded-xl" : "px-0 py-0 rounded-none",
                viewMode === 'collections' 
                  ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200/70 dark:bg-zinc-800/70" 
                  : "text-zinc-400 hover:text-zinc-600 bg-transparent"
              )}
           >
             <Library className={twMerge(isMobile ? "w-4 h-4" : "w-3 h-3")} />
             <span>书籍</span>
           </button>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
            {/* Mobile Quick Actions */}
            {isMobile && (
              <div className="flex items-center gap-2">
                <a href="/learning" className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all active:scale-95 touch-manipulation">
                    <GraduationCap className="w-5 h-5" />
                </a>
                <a href="/qa" className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 touch-manipulation">
                    <Sparkles className="w-5 h-5" />
                </a>
                <a href="/search" className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 touch-manipulation">
                    <Command className="w-5 h-5" />
                </a>
              </div>
            )}

            {/* Desktop Quick Links */}
            <div className="hidden md:flex items-center gap-4">
              <a href="/learning" className="flex items-center gap-1 text-[10px] font-mono text-indigo-500 hover:text-indigo-600 transition-colors group">
                  <GraduationCap className="w-3 h-3 group-hover:animate-pulse" />
                  学习
              </a>

              <a href="/qa" className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-600 transition-colors group">
                  <Sparkles className="w-3 h-3" />
                  问答
              </a>

              <a href="/search" className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-600 transition-colors">
                  <Command className="w-3 h-3" />
                  搜索
              </a>

              <span className="text-[10px] font-mono text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-4">
                  {viewMode === 'articles' ? totalArticlesCount : totalCollectionsCount} 记录
              </span>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-4 space-y-2 md:space-y-2 no-scrollbar relative">
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
        <div className="h-20 md:h-20" /> {/* Bottom spacer */}
      </div>
    </section>
  );
}
