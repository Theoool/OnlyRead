"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  X,
  FileText,
  Brain,
  Tag,
  Filter,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useSearch } from "@/lib/hooks"

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [type, setType] = useState<"all" | "concepts" | "articles">("all")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // 使用React Query进行搜索
  const { data: results, isLoading } = useSearch(debouncedQuery, type)

  const handleClear = () => {
    setQuery("")
  }

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/30 text-zinc-900 dark:text-white rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Search</h1>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts and articles..."
              className="w-full pl-12 pr-12 py-3 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-black dark:focus:border-white rounded-xl outline-none transition-colors text-zinc-900 dark:text-white placeholder:text-zinc-400"
              autoFocus
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>

          {/* Type Filter & Mode Indicator */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === 'all'
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setType('concepts')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === 'concepts'
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                Concepts
              </button>
              <button
                onClick={() => setType('articles')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === 'articles'
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                Articles
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        )}

        {!isLoading && !query && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Start searching
            </h2>
            <p className="text-zinc-400 dark:text-zinc-600">
              Search through your concepts and articles
            </p>
          </div>
        )}

        {!isLoading && query && results && (
          <div>
            {/* Results count */}
            <div className="mb-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Found {results.total} result{results.total !== 1 ? 's' : ''} for "{results.query}"
              </p>
            </div>

            {/* Concepts */}
            {results.concepts.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Concepts ({results.concepts.length})
                </h3>
                <div className="space-y-4">
                  {results.concepts.map((concept) => (
                    <motion.div
                      key={concept.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
                      onClick={() => {
                        // Navigate to review or concept detail
                        if (concept.sourceArticleId) {
                          router.push(`/read?id=${concept.sourceArticleId}`)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">
                          {highlightMatch(concept.term, query)}
                        </h4>
                        <div className="flex items-center gap-2">
                          {concept.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                        {concept.snippet}
                      </p>
                      <div className="flex items-center gap-4 mt-4 text-xs text-zinc-400">
                        <span>Reviewed {concept.reviewCount} times</span>
                        <span>•</span>
                        <span>Confidence: {concept.confidence}/5</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Articles */}
            {results.articles.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Articles ({results.articles.length})
                </h3>
                <div className="space-y-4">
                  {results.articles.map((article) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
                      onClick={() => router.push(`/read?id=${article.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-lg font-semibold text-zinc-900 dark:text-white flex-1">
                          {article.title ? highlightMatch(article.title, query) : 'Untitled'}
                        </h4>
                        <span className="text-xs text-zinc-400 ml-4">
                          {article.progress || 0}%
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-3">
                        {article.domain}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                        {article.snippet}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {results.total === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  No results found
                </h3>
                <p className="text-zinc-400 dark:text-zinc-600">
                  Try different keywords or search in a different category
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
