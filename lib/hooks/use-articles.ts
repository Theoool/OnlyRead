'use client'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import * as articlesAPI from '@/lib/core/reading/articles.service'

// Query Keys
export const queryKeys = {
  articles: ['articles'] as const,
  article: (id: string) => ['article', id] as const,
  concepts: ['concepts'] as const,
  quickStats: ['quickStats'] as const,
}

/**
 * 获取所有文章列表（支持分页）
 */
export function useArticles(options: {
  page?: number;
  pageSize?: number;
  limit?: number;
  type?: string;
} = {}) {
  const { page, pageSize, limit, type } = options;
  return useQuery({
    queryKey: [...queryKeys.articles, page, pageSize, limit, type],
    queryFn: () => articlesAPI.getArticles({ page, pageSize, limit, type }),
  })
}

/**
 * 无限滚动获取文章列表
 */
export function useArticlesInfinite(options: {
  pageSize?: number;
  type?: string;
} = {}) {
  const { pageSize = 20, type } = options;

  return useInfiniteQuery({
    queryKey: ['articles', 'infinite', pageSize, type],
    queryFn: ({ pageParam = 1 }) =>
      articlesAPI.getArticles({ page: pageParam, pageSize, type }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.pagination?.hasNext) {
        return lastPageParam + 1;
      }
      return undefined;
    },
  });
}

/**
 * 获取单篇文章
 */
export function useArticle(id: string) {
  const a= useQuery({
    queryKey: queryKeys.article(id),
    queryFn: () => articlesAPI.getArticle(id),
    enabled: !!id,
    retry: 1,
  })
  return a
}

/**
 * 保存文章（新建或更新）
 */
export function useSaveArticle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (article: Parameters<typeof articlesAPI.saveArticle>[0]) =>
      articlesAPI.saveArticle(article),
    onSuccess: () => {
      // 保存成功后刷新文章列表
      queryClient.invalidateQueries({ queryKey: queryKeys.articles })
    },
  })
}

/**
 * 删除文章
 */
export function useDeleteArticle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => articlesAPI.deleteArticle(id),
    onSuccess: () => {
      // 删除成功后刷新文章列表
      queryClient.invalidateQueries({ queryKey: queryKeys.articles })
    },
  })
}

/**
 * 更新文章阅读进度
 */
export function useUpdateArticleProgress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, progress, lastReadSentence, lastRead, skipInvalidation }: {
      id: string
      progress?: number
      lastReadSentence?: number
      lastRead?: number
      skipInvalidation?: boolean
    }) => articlesAPI.updateArticle(id, { progress, lastReadSentence, lastRead }),
    onSuccess: (_, variables) => {
      if (variables.skipInvalidation) return

      // 更新成功后刷新该文章的缓存
      queryClient.invalidateQueries({ queryKey: queryKeys.article(variables.id) })
      // 同时刷新文章列表
      queryClient.invalidateQueries({ queryKey: queryKeys.articles })
    },
  })
}

/**
 * 获取文章的导航信息（上一章、下一章、所属合集）
 */
export function useArticleNavigation(articleId: string | undefined) {
  return useQuery({
    queryKey: ['article', articleId, 'navigation'],
    queryFn: async () => {
      if (!articleId) return null;
      const res = await fetch(`/api/collections/${articleId}/navigation`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.data.navigation;
    },
    enabled: !!articleId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
