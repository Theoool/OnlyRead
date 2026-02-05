import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Link as LinkIcon, Sparkles, ArrowRight } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { Article } from "@/lib/core/reading/articles.service";
import { formatRelative } from "@/lib/utils";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";

interface ArticleListProps {
  articles: Article[];
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function ArticleList({ articles, isLoading, onLoadMore, hasMore }: ArticleListProps) {
  const router = useRouter();
  const { concepts } = useConceptStore();

  // Efficient concept lookup
  const conceptsByArticle = useMemo(() => {
    const map = new Map<string, ConceptData[]>();
    Object.values(concepts).forEach(concept => {
      if (concept.sourceArticleId) {
        const existing = map.get(concept.sourceArticleId) || [];
        existing.push(concept);
        map.set(concept.sourceArticleId, existing);
      }
    });
    return map;
  }, [concepts]);

  const onClickItem = (a: Article) => {
    router.push(`/read?id=${a.id}`);
  };

  if (isLoading && articles.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-20">
      <AnimatePresence mode="popLayout" initial={false}>
        {articles.map((article, i) => {
          const articleConcepts = conceptsByArticle.get(article.id) || [];
          
          return (
            <motion.div
              layout
              key={article.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }}
              role="button"
              tabIndex={0}
              onClick={() => onClickItem(article)}
              className="w-full group text-left p-4 rounded-lg bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all relative overflow-hidden"
            >
              <div className="flex justify-between items-start gap-4 relative z-10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">
                      {article.domain}
                    </span>
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {formatRelative(article.lastRead || Date.now())}
                    </span>
                  </div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate text-sm md:text-base mb-2">
                    {article.title}
                  </h3>
                  
                  {/* Concept Pills */}
                  {articleConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                          {articleConcepts.slice(0, 3).map((c, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 truncate max-w-[100px]">
                                  {c.term}
                              </span>
                          ))}
                          {articleConcepts.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 text-zinc-400">+{articleConcepts.length - 3}</span>
                          )}
                      </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end justify-between h-full gap-2">
                  {article.domain === "手动粘贴" ? (
                    <FileText className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
                  ) : (
                    <LinkIcon className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
                  )}
                  
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/qa?articleIds=${article.id}`);
                      }}
                      className="p-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-zinc-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                      title="Chat with Article"
                  >
                      <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar Background */}
              {article.progress > 0 && (
                <div className="absolute bottom-0 left-0 h-1 bg-zinc-100 dark:bg-zinc-900 w-full">
                   <motion.div 
                    className="h-full bg-zinc-900 dark:bg-zinc-100"
                    initial={{ width: 0 }}
                    animate={{ width: `${article.progress}%` }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}

        {articles.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4 opacity-50 mt-20">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
              <ArrowRight className="w-5 h-5" />
            </div>
            <p className="text-xs font-mono">等待输入...</p>
          </div>
        )}
      </AnimatePresence>

      {hasMore && (
        <div className="px-4 pb-4">
          <button
            onClick={onLoadMore}
            className="w-full py-3 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-2"
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}
