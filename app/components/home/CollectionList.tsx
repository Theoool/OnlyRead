import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Book, ChevronDown, Sparkles, Loader2, Check, ChevronRight, AlertCircle, RefreshCw, Cloud } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { formatRelative } from "@/lib/utils";
import { useCollectionData } from "@/lib/hooks/home/useCollectionData";
import { useSyncStatus } from "@/lib/hooks/home/useSyncStatus";
import { IdManager } from "@/lib/import/id-manager";
import { useState } from "react";
import { toast } from "sonner";

interface CollectionListProps {
  collections: any[]; // Using any because of the mixed type (Collection + local properties)
  isLoading: boolean;
  onRetrySync?: (localId: string) => void;
}

export function CollectionList({ collections, isLoading, onRetrySync }: CollectionListProps) {
  const router = useRouter();
  const { 
    expandedCollectionId, 
    toggleCollection, 
    getCollectionArticles, 
    isLoading: isCollectionLoading,
    error
  } = useCollectionData();

  // 处理切换到本地阅读
  const handleSwitchToLocal = async (collection: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (collection.localId) {
      router.push(`/read?localId=${collection.localId}`);
    } else {
      toast.error("未找到本地副本");
    }
  };

  // 处理切换到云端阅读
  const handleSwitchToCloud = async (collection: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (collection.cloudId) {
      router.push(`/read?id=${collection.cloudId}`);
    } else {
      toast.error("未找到云端副本");
    }
  };

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
          <CollectionItem
            key={collection.id}
            collection={collection}
            index={i}
            isExpanded={expandedCollectionId === collection.id}
            isLoading={isCollectionLoading(collection.id)}
            articles={getCollectionArticles(collection.id)}
            error={error}
            onToggle={() => {
              // 优先打开云端（有章节列表）
              if (collection.cloudId) {
                toggleCollection(collection.cloudId);
              } else if (collection.localId) {
                router.push(`/read?localId=${collection.localId}`);
              }
            }}
            onSwitchToLocal={handleSwitchToLocal}
            onSwitchToCloud={handleSwitchToCloud}
            onRetrySync={onRetrySync}
            router={router}
          />
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

// 单个书籍项组件
function CollectionItem({
  collection,
  index,
  isExpanded,
  isLoading,
  articles,
  error,
  onToggle,
  onSwitchToLocal,
  onSwitchToCloud,
  onRetrySync,
  router,
}: {
  collection: any;
  index: number;
  isExpanded: boolean;
  isLoading: boolean;
  articles?: any[];
  error?: string | null;
  onToggle: () => void;
  onSwitchToLocal: (collection: any, e: React.MouseEvent) => void;
  onSwitchToCloud: (collection: any, e: React.MouseEvent) => void;
  onRetrySync?: (localId: string) => void;
  router: any;
}) {
  // 使用同步状态 Hook（如果有本地副本）
  const syncStatus = useSyncStatus(collection.localId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className="w-full group text-left p-4 rounded-lg bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all relative overflow-hidden"
    >
      <div
        className="flex justify-between items-start cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={twMerge(
            "p-2 rounded text-zinc-500", "bg-zinc-100 dark:bg-zinc-900"
          )}>
            <Book className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm md:text-base">
              {collection.title}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {collection.cloudId ? `${collection._count?.articles || 0} 章` : '本地文件'}
              {collection.hasLocalCopy && collection.cloudId && ' • 本地+云端'}
              {collection.updatedAt && (() => {
                const timestamp = new Date(collection.updatedAt).getTime();
                return !isNaN(timestamp) ? ` • ${formatRelative(timestamp)}前` : '';
              })()}
            </p>
            
            {/* 同步状态显示 */}
            {collection.localId && syncStatus.syncStatus !== 'synced' && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className={twMerge(
                        "h-full",
                        syncStatus.isError ? "bg-red-500" : "bg-blue-500"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${syncStatus.syncProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                    {syncStatus.statusText}
                  </span>
                </div>
                
                {/* 错误提示和重试按钮 */}
                {syncStatus.isError && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span className="text-[10px] text-red-500 flex-1">
                      {syncStatus.book?.syncError || '同步失败'}
                    </span>
                    {onRetrySync && collection.localId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetrySync(collection.localId);
                        }}
                        className="text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        重试
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 本地阅读按钮 */}
          {collection.localId && (
            <button
              onClick={(e) => onSwitchToLocal(collection, e)}
              className="p-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-zinc-400 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
              title="本地阅读"
            >
              <Book className="w-4 h-4" />
            </button>
          )}
          
         
          {collection.cloudId && (
            <ChevronDown className={twMerge(
              "w-4 h-4 text-zinc-400 transition-transform",
              isExpanded ? "rotate-180" : ""
            )} />
          )}
        </div>
      </div>


      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pl-4 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
              {/* Show chapter list */}
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                </div>
              ) : (
                articles?.map((article: any, idx: number) => (
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
              {error && isExpanded && (
                <div className="text-xs text-red-500 text-center py-2">
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
