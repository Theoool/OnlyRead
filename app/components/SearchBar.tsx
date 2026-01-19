"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, FileText, Brain, Command } from "lucide-react"
import { useSearch } from "@/lib/hooks"
import { useDebounce } from "@/lib/hooks/use-debounce"



interface Concept {
  id: string
  term: string
  myDefinition: string
  sourceArticleId?: string | null
}

interface Article {
  id: string
  title: string | null
  domain: string | null
  snippet?: string
}

interface SearchResult {
  concepts: Concept[]
  articles: Article[]
  total: number
}

interface SearchBarProps {
  placeholder?: string
  className?: string
}

export function SearchBar({ placeholder = "搜索... (Cmd+K)", className = "" }: SearchBarProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  // 使用 React Query 的 useSearch hook - 自动防抖、缓存、加载状态
  const { data: results, isLoading } = useSearch(debouncedQuery, 'all')

  // 计算所有结果项
  const allItems = useMemo(() => [
    ...(results?.concepts.map(c => ({ type: 'concept' as const, data: c })) || []),
    ...(results?.articles.map(a => ({ type: 'article' as const, data: a })) || []),
  ], [results])

  // 重置选中索引当结果变化时
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // 处理结果点击
  const handleResultClick = useCallback((type: 'concept' | 'article', id: string, sourceArticleId?: string) => {
    if (type === 'concept' && sourceArticleId) {
      router.push(`/read?id=${sourceArticleId}`)
    } else if (type === 'article') {
      router.push(`/read?id=${id}`)
    }
    closeSearch()
  }, [router])

  // 关闭搜索并重置
  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setSelectedIndex(0)
  }, [])

  // 打开搜索并聚焦
  const openSearch = useCallback(() => {
    setIsOpen(true)
    // 使用 setTimeout 确保 DOM 更新后再聚焦
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

  // 键盘快捷键 - Cmd+K 打开搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          closeSearch()
        } else {
          openSearch()
        }
      }

      // ESC 关闭搜索
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        closeSearch()
      }

      // 键盘导航 - 仅当搜索打开且有结果时
      if (isOpen && allItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % allItems.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const selectedItem = allItems[selectedIndex]
          if (selectedItem) {
            if (selectedItem.type === 'concept') {
              handleResultClick('concept', selectedItem.data.id, selectedItem.data.sourceArticleId || undefined)
            } else {
              handleResultClick('article', selectedItem.data.id)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, allItems, selectedIndex, closeSearch, openSearch, handleResultClick])

  // 点击外部关闭搜索
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, closeSearch])

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Button */}
      <button
        onClick={openSearch}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors text-left"
      >
        <Search className="w-5 h-5 text-zinc-400 flex-shrink-0" />
        <span className="text-zinc-500 dark:text-zinc-400 flex-1">{placeholder}</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-400 bg-zinc-200 dark:bg-zinc-700 rounded">
          <Command className="w-3 h-3" />
          K
        </kbd>
      </button>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Search Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden"
            >
              {/* Search Input */}
              <div className="flex  items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <Search className="w-5 h-5 text-zinc-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索概念和文章..."
                  className="flex-1 bg-transparent outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery("")
                    }}
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded">
                  ESC
                </kbd>
              </div>

              {/* Search Results */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-zinc-300 border-t-black dark:border-t-white rounded-full animate-spin" />
                  </div>
                )}

                {!isLoading && !query && (
                  <div className="py-12 text-center">
                    <Search className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 dark:text-zinc-400">
                      输入以开始搜索...
                    </p>
                  </div>
                )}

                {!isLoading && query && results && results.total === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-zinc-500 dark:text-zinc-400">
                      未找到结果："{query}"
                    </p>
                  </div>
                )}

                {!isLoading && query && results && results.total > 0 && (
                  <div className="space-y-1">
                    {results.concepts.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                          概念
                        </p>
                        {results.concepts.map((concept, index) => (
                          <button
                            key={concept.id}
                            onClick={() => handleResultClick('concept', concept.id, concept.sourceArticleId || undefined)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                              index === selectedIndex
                                ? 'bg-zinc-100 dark:bg-zinc-800'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                            }`}
                          >
                            <Brain className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            <div className="flex-1 text-left">
                              <p className="font-medium text-zinc-900 dark:text-white">
                                {concept.term}
                              </p>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">
                                {concept.myDefinition}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {results.articles.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                          Articles
                        </p>
                        {results.articles.map((article, index) => {
                          const globalIndex = results.concepts.length + index
                          return (
                            <button
                              key={article.id}
                              onClick={() => handleResultClick('article', article.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                globalIndex === selectedIndex
                                  ? 'bg-zinc-100 dark:bg-zinc-800'
                                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <div className="flex-1 text-left">
                                <p className="font-medium text-zinc-900 dark:text-white line-clamp-1">
                                  {article.title || 'Untitled'}
                                </p>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                  {article.domain}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              {results && results.total > 0 && (
                <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex items-center gap-4">
                      <span>↑↓ 导航</span>
                      <span>↵ 选择</span>
                      <span>ESC 关闭</span>
                    </div>
                    <button
                      onClick={() => {
                        router.push(`/search?q=${encodeURIComponent(query)}`)
                        closeSearch()
                      }}
                      className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      查看所有 {results.total} 结果 →
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
