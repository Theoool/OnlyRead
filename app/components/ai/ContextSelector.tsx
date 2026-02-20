'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Book, FileText, Check, ChevronDown, ChevronRight, Library, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Article {
  id: string;
  title: string;
  domain?: string;
  collectionId?: string;
}

interface Collection {
  id: string;
  title: string;
  type: string;
}

interface ContextSelectorProps {
  articles: Article[];
  collections: Collection[];
  selectedContext: {
    articleIds: string[];
    collectionId?: string;
  };
  onContextChange: (context: { articleIds: string[]; collectionId?: string }) => void;
  className?: string;
}

export function ContextSelector({
  articles,
  collections,
  selectedContext,
  onContextChange,
  className
}: ContextSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  // Group articles by collection
  const groupedItems = useMemo(() => {
    const groups: Record<string, Article[]> = {
      'unorganized': []
    };
    
    collections.forEach(c => {
      groups[c.id] = [];
    });

    articles.forEach(article => {
      if (article.collectionId && groups[article.collectionId]) {
        groups[article.collectionId].push(article);
      } else {
        groups['unorganized'].push(article);
      }
    });

    return groups;
  }, [articles, collections]);

  const filteredCollections = useMemo(() => {
    if (!searchTerm) return collections;
    return collections.filter(c => 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      groupedItems[c.id]?.some(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [collections, searchTerm, groupedItems]);

  const filteredUnorganized = useMemo(() => {
    if (!searchTerm) return groupedItems['unorganized'];
    return groupedItems['unorganized'].filter(a => 
      a.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedItems, searchTerm]);

  const toggleArticle = (articleId: string) => {
    const currentIds = selectedContext.articleIds;
    const isSelected = currentIds.includes(articleId);
    
    let newIds: string[];
    if (isSelected) {
      newIds = currentIds.filter(id => id !== articleId);
    } else {
      newIds = [...currentIds, articleId];
    }
    
    onContextChange({
      ...selectedContext,
      articleIds: newIds,
      collectionId: newIds.length > 0 ? undefined : selectedContext.collectionId
    });
  };

  const toggleCollection = (collectionId: string) => {
    if (selectedContext.collectionId === collectionId) {
      onContextChange({ ...selectedContext, collectionId: undefined });
    } else {
      onContextChange({ 
        ...selectedContext, 
        collectionId,
        articleIds: []
      });
    }
  };

  const toggleExpanded = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  const selectedCount = selectedContext.collectionId ? 1 : selectedContext.articleIds.length;

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-zinc-900", className)}>
      {/* Header with Search */}
      <div className="p-3 md:p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0 space-y-3">
        {/* Title and Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              上下文库
            </span>
          </div>
          {selectedCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-full"
            >
              已选 {selectedCount}
            </motion.div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input 
            type="text"
            placeholder="搜索文档..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all touch-manipulation"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            style={{ fontSize: '16px' }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
            >
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Collections Section */}
        {filteredCollections.map(collection => {
            const isSelected = selectedContext.collectionId === collection.id;
            const isExpanded = expandedCollections.has(collection.id);
            const collectionArticles = groupedItems[collection.id] || [];
            const hasArticles = collectionArticles.length > 0;
            
            const matchingArticles = searchTerm 
              ? collectionArticles.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
              : collectionArticles;

            return (
                <div key={collection.id} className="space-y-0.5">
                    {/* Collection Item */}
                    <div className="flex items-center gap-1">
                      {/* Expand Button */}
                      {hasArticles && (
                        <button
                          onClick={() => toggleExpanded(collection.id)}
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors touch-manipulation flex-shrink-0"
                          aria-label={isExpanded ? '收起' : '展开'}
                        >
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="w-3 h-3 text-zinc-400" />
                          </motion.div>
                        </button>
                      )}
                      
                      {/* Collection Button */}
                      <button
                        onClick={() => toggleCollection(collection.id)}
                        className={cn(
                            "flex-1 flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all group touch-manipulation active:scale-[0.98]",
                            !hasArticles && "ml-5",
                            isSelected 
                                ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-700"
                        )}
                        aria-pressed={isSelected}
                        aria-label={`选择集合: ${collection.title}`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <Book className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isSelected ? "text-indigo-500" : "text-zinc-400"
                            )} />
                            <span className="truncate font-medium">{collection.title}</span>
                            {hasArticles && (
                              <span className="text-xs text-zinc-400 flex-shrink-0">
                                {collectionArticles.length}
                              </span>
                            )}
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <Check className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                          </motion.div>
                        )}
                      </button>
                    </div>
                    
                    {/* Nested Articles */}
                    <AnimatePresence>
                      {(isExpanded || searchTerm) && matchingArticles.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-0.5 ml-5"
                        >
                          {matchingArticles.map(article => {
                            const isArticleSelected = selectedContext.articleIds.includes(article.id);
                            
                            return (
                              <button
                                  key={article.id}
                                  onClick={() => toggleArticle(article.id)}
                                  className={cn(
                                      "w-full flex items-center gap-2 pl-6 pr-3 py-2 text-xs rounded-lg transition-all touch-manipulation active:scale-[0.98]",
                                      isArticleSelected
                                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/20 font-medium"
                                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-700/50"
                                  )}
                                  aria-pressed={isArticleSelected}
                                  aria-label={`选择文章: ${article.title}`}
                              >
                                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate text-left flex-1">{article.title}</span>
                                  {isArticleSelected && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                    >
                                      <Check className="w-3 h-3 flex-shrink-0" />
                                    </motion.div>
                                  )}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                </div>
            );
        })}

        {/* Divider */}
        {filteredCollections.length > 0 && filteredUnorganized.length > 0 && (
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-3 mx-2" />
        )}

        {/* Unorganized Articles */}
        {filteredUnorganized.length > 0 && (
            <div className="space-y-0.5">
                <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    独立文章
                </div>
                {filteredUnorganized.map(article => {
                    const isSelected = selectedContext.articleIds.includes(article.id);
                    return (
                        <button
                            key={article.id}
                            onClick={() => toggleArticle(article.id)}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all touch-manipulation active:scale-[0.98]",
                                isSelected
                                    ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-700"
                            )}
                            aria-pressed={isSelected}
                            aria-label={`选择文章: ${article.title}`}
                        >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <FileText className={cn(
                                  "w-4 h-4 flex-shrink-0",
                                  isSelected ? "text-indigo-500" : "text-zinc-400"
                                )} />
                                <span className="truncate">{article.title}</span>
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <Check className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                              </motion.div>
                            )}
                        </button>
                    );
                })}
            </div>
        )}

        {/* Empty State */}
        {filteredCollections.length === 0 && filteredUnorganized.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 px-4"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
              <Search className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500">
              {searchTerm ? '没有找到匹配的内容' : '暂无可用内容'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
