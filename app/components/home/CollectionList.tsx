import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Book, ChevronDown, Sparkles, Loader2, Check, ChevronRight } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { formatRelative } from "@/lib/utils";
import { useCollectionData } from "@/lib/hooks/home/useCollectionData";

interface CollectionListProps {
  collections: any[]; // Using any because of the mixed type (Collection + local properties)
  isLoading: boolean;
}

export function CollectionList({ collections, isLoading }: CollectionListProps) {
  const router = useRouter();
  const { 
    expandedCollectionId, 
    toggleCollection, 
    getCollectionArticles, 
    isLoading: isCollectionLoading,
    error
  } = useCollectionData();

  if (isLoading && collections.length === 0) {
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
        {collections.map((collection, i) => (
          <motion.div
            layout
            key={collection.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: i * 0.05 }}
            className="w-full group text-left p-4 rounded-lg bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all relative overflow-hidden"
          >
            <div
              className="flex justify-between items-start cursor-pointer"
              onClick={() => {
                if (collection.isLocal) {
                   router.push(`/read?localId=${collection.id}`);
                   return;
                }
                toggleCollection(collection.id);
              }}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded text-zinc-500">
                        <Book className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm md:text-base">
                            {collection.title}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1">
                            {collection.isLocal ? '本地文件' : `${collection._count?.articles || 0} 章`} • {formatRelative(new Date(collection.updatedAt).getTime())}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Local Reading Mode Toggle */}
                    {collection.hasLocalCopy && !collection.isLocal && (
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/read?localId=${collection.id}`);
                            }}
                            className="p-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-zinc-300 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                            title="Switch to Local Reader"
                        >
                            <Book className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (collection.isLocal) {
                                router.push(`/read?localId=${collection.id}`);
                            } else {
                                router.push(`/qa?collectionId=${collection.id}`);
                            }
                        }}
                        className="p-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-zinc-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                        title={collection.isLocal ? "Open in Reader" : "Chat with Book"}
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    
                    {!collection.isLocal && (
                    <ChevronDown className={twMerge(
                        "w-4 h-4 text-zinc-400 transition-transform",
                        expandedCollectionId === collection.id ? "rotate-180" : ""
                    )} />
                    )}
                </div>
            </div>

            <AnimatePresence>
                {expandedCollectionId === collection.id && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-4 pl-4 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
                            {/* Show chapter list */}
                            {isCollectionLoading(collection.id) ? (
                                /* Loading state */
                                <div className="flex justify-center py-4">
                                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                </div>
                            ) : (
                                getCollectionArticles(collection.id)?.map((article: any, idx: number) => (
                                    <button
                                        key={article.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/read?id=${article.id}`);
                                        }}
                                        className="w-full text-left group py-2 px-3 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-[10px] font-mono text-zinc-400">
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                                                {article.title}
                                            </span>
                                            {article.progress > 0 && (
                                                <span className="text-[10px] text-zinc-400">
                                                    {article.progress}%
                                                </span>
                                            )}
                                        </div>
                                        {article.progress === 100 ? (
                                            <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                        ) : (
                                            <ChevronRight className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                        )}
                                    </button>
                                ))
                            )}

                            {/* Error state */}
                            {error && expandedCollectionId === collection.id && (
                              <div className="text-xs text-red-500 text-center py-2">
                                {error}
                              </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        ))}
        
        {collections.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4 opacity-50 mt-20">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                    <Book className="w-5 h-5" />
                </div>
                <p className="text-xs font-mono">未找到书籍</p>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
