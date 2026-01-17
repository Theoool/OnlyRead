'use client'

import { useQuery } from '@tanstack/react-query'

interface Concept {
  id: string
  term: string
  myDefinition: string
  myExample: string
  confidence: number
  tags: string[]
  reviewCount: number
  nextReviewDate: string | null
  relevanceScore: number
  snippet: string
  sourceArticleId: string | null
}

interface Article {
  id: string
  title: string | null
  domain: string | null
  progress: number
  relevanceScore: number
  snippet: string
  createdAt: string
}

interface SearchResults {
  concepts: Concept[]
  articles: Article[]
  total: number
  query: string
}

/**
 * 搜索hook - 搜索概念和文章
 */
export function useSearch(query: string, type: 'all' | 'concepts' | 'articles' = 'all') {
  return useQuery({
    queryKey: ['search', query, type],
    queryFn: async () => {
      if (!query.trim()) {
        return { concepts: [], articles: [], total: 0, query: '' } as SearchResults
      }

      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&type=${type}`,
     
      )

      if (!res.ok) {
        throw new Error('Search failed')
      }

      return res.json() as Promise<SearchResults>
    },
    enabled: query.trim().length > 0,
    staleTime: 1000 * 60 * 1, // 1分钟 - 搜索结果不需要长期缓存
    gcTime: 1000 * 60 * 5, // 5分钟后清除缓存
    retry: false, // 搜索失败不重试
  })
}
