'use client'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import * as articlesAPI from '@/lib/core/reading/articles.service'
import { Article } from '@/lib/core/reading/articles.service'
import { saveArticle, updateArticleProgress, deleteArticle } from '@/app/actions/article'
import { queryKeys } from './query-keys'

/**
 * 获取所有文章列表（支持分页）
 */
export function useArticles(options: {
  page?: number;
  pageSize?: number;
  limit?: number;
  type?: string;
  initialData?: { articles: Article[]; pagination?: any };
} = {}) {
  const { page, pageSize, limit, type, initialData } = options;
  return useQuery({
    queryKey: queryKeys.articles.list({ page, pageSize, limit, type }),
    queryFn: () => articlesAPI.getArticles({ page, pageSize, limit, type }),
    initialData,
    staleTime: 1000 * 60, // 1分钟内不重新请求
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
    queryKey: queryKeys.articles.infinite({ pageSize, type }),
    queryFn: ({ pageParam = 1 }) =>
      articlesAPI.getArticles({ page: pageParam, pageSize, type }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.pagination?.hasNext) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    staleTime: 1000 * 60, // 1分钟
  });
}

/**
 * 获取单篇文章
 */
export function useArticle(id: string, options: { initialData?: Article } = {}) {
  const { initialData } = options;
  return useQuery({
    queryKey: queryKeys.articles.detail(id),
    queryFn: () => articlesAPI.getArticle(id),
    enabled: !!id,
    retry: 1,
    initialData,
    staleTime: 1000 * 60 * 5, // 5分钟
  })
}

/**
 * 保存文章（新建或更新）
 */
export function useSaveArticle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (article: Partial<Article> & { title: string; content: string }) => {
      const res = await saveArticle(article);
      if (!res.success) throw new Error('Save failed');
      return res.article;
    },
    onSuccess: (savedArticle) => {
      // 精确更新：只刷新文章列表，不影响其他查询
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.articles.lists(),
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.articles.infinite({}) 
      })
      
      // 如果是更新操作，同时更新详情缓存
      if (savedArticle?.id) {
        queryClient.setQueryData(
          queryKeys.articles.detail(savedArticle.id),
          savedArticle
        )
      }
    },
  })
}

/**
 * 删除文章
 */
export function useDeleteArticle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
        const res = await deleteArticle(id);
        if (!res.success) throw new Error('Delete failed');
        return res;
    },
    onSuccess: (_, deletedId) => {
      // 精确更新：移除详情缓存，刷新列表
      queryClient.removeQueries({ 
        queryKey: queryKeys.articles.detail(deletedId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.articles.lists() 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.articles.infinite({}) 
      })
    },
  })
}

/**
 * 更新文章阅读进度
 */
export function useUpdateArticleProgress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, progress, lastReadSentence, lastRead, skipInvalidation }: {
      id: string
      progress?: number
      lastReadSentence?: number
      lastRead?: number
      skipInvalidation?: boolean
    }) => {
        const res = await updateArticleProgress(id, { progress, lastReadSentence, lastRead });
        if (!res.success) throw new Error('Update failed');
        return res.article;
    },
    onSuccess: (updatedArticle, variables) => {
      if (variables.skipInvalidation) return

      // 乐观更新：直接更新缓存，避免重新请求
      if (updatedArticle) {
        queryClient.setQueryData(
          queryKeys.articles.detail(variables.id),
          updatedArticle
        )
      }
      
      // 只在进度有显著变化时才刷新列表（避免频繁刷新）
      if (variables.progress !== undefined) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.articles.lists() 
        })
      }
    },
  })
}

/**
 * 获取文章的导航信息（上一章、下一章、所属合集）
 */
export function useArticleNavigation(articleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.articles.navigation(articleId || ''),
    queryFn: async () => {
      if (!articleId) return null;
      const res = await fetch(`/api/articles/${articleId}/navigation?includeCollection=true`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    },
    enabled: !!articleId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
