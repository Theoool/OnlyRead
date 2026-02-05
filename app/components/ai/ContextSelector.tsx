'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Book, FileText, Check, ChevronDown, ChevronRight, Library } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(true);

  // Group articles by collection (or 'Unorganized')
  const groupedItems = useMemo(() => {
    const groups: Record<string, Article[]> = {
      'unorganized': []
    };
    
    // Initialize groups for all collections
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
      c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [collections, searchTerm]);

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
      // Enforce mutual exclusivity: If selecting articles, clear collection selection
      collectionId: newIds.length > 0 ? undefined : selectedContext.collectionId
    });
  };

  const toggleCollection = (collectionId: string) => {
    // If clicking the same collection, deselect it
    if (selectedContext.collectionId === collectionId) {
      onContextChange({ ...selectedContext, collectionId: undefined });
    } else {
      // Enforce mutual exclusivity: If selecting a collection, clear specific article selections
      onContextChange({ 
        ...selectedContext, 
        collectionId,
        articleIds: []
      });
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800", className)}>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          <Library className="w-4 h-4" />
          Context Library
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text"
            placeholder="Filter docs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Collections Section */}
        {filteredCollections.map(collection => {
            const isSelected = selectedContext.collectionId === collection.id;
            const collectionArticles = groupedItems[collection.id] || [];
            const hasMatches = searchTerm && collectionArticles.some(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));
            
            // If searching, and collection title doesn't match but children do, show it.
            // If collection matches, show it.
            if (searchTerm && !collection.title.toLowerCase().includes(searchTerm.toLowerCase()) && !hasMatches) {
                return null;
            }

            return (
                <div key={collection.id} className="space-y-1">
                    <button
                        onClick={() => toggleCollection(collection.id)}
                        className={cn(
                            "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group",
                            isSelected 
                                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        )}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Book className="w-4 h-4 shrink-0 opacity-70" />
                            <span className="truncate font-medium">{collection.title}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                    
                    {/* Nested Articles (only show if collection is selected or searching) */}
                    {(isSelected || searchTerm) && collectionArticles.map(article => {
                         if (searchTerm && !article.title.toLowerCase().includes(searchTerm.toLowerCase())) return null;
                         const isArticleSelected = selectedContext.articleIds.includes(article.id);
                         
                         return (
                            <button
                                key={article.id}
                                onClick={() => toggleArticle(article.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs rounded-md transition-colors",
                                    isArticleSelected
                                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                                )}
                            >
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="truncate text-left">{article.title}</span>
                                {isArticleSelected && <Check className="w-3 h-3 shrink-0 ml-auto" />}
                            </button>
                         );
                    })}
                </div>
            );
        })}

        {/* Divider if needed */}
        {filteredCollections.length > 0 && filteredUnorganized.length > 0 && (
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2 mx-2" />
        )}

        {/* Unorganized Articles */}
        {filteredUnorganized.length > 0 && (
            <div className="space-y-1">
                <div className="px-3 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Articles
                </div>
                {filteredUnorganized.map(article => {
                    const isSelected = selectedContext.articleIds.includes(article.id);
                    return (
                        <button
                            key={article.id}
                            onClick={() => toggleArticle(article.id)}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                                isSelected
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            )}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="w-4 h-4 shrink-0 opacity-70" />
                                <span className="truncate">{article.title}</span>
                            </div>
                            {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                    );
                })}
            </div>
        )}
      </div>
      
     
    </div>
  );
}
