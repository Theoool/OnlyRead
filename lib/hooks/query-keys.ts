/**
 * 集中管理所有 React Query 的 queryKeys
 * 遵循最佳实践：使用工厂函数创建层级化的 keys
 */

export const queryKeys = {
  // Articles
  articles: {
    all: ['articles'] as const,
    lists: () => [...queryKeys.articles.all, 'list'] as const,
    list: (filters: { page?: number; pageSize?: number; limit?: number; type?: string }) => 
      [...queryKeys.articles.lists(), filters] as const,
    infinite: (filters: { pageSize?: number; type?: string }) => 
      [...queryKeys.articles.all, 'infinite', filters] as const,
    details: () => [...queryKeys.articles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.articles.details(), id] as const,
    navigation: (id: string) => [...queryKeys.articles.detail(id), 'navigation'] as const,
  },

  // Collections
  collections: {
    all: ['collections'] as const,
    lists: () => [...queryKeys.collections.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.collections.lists(), filters] as const,
    details: () => [...queryKeys.collections.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.collections.details(), id] as const,
    articles: (id: string) => [...queryKeys.collections.detail(id), 'articles'] as const,
  },

  // Concepts
  concepts: {
    all: ['concepts'] as const,
    lists: () => [...queryKeys.concepts.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.concepts.lists(), filters] as const,
    details: () => [...queryKeys.concepts.all, 'detail'] as const,
    detail: (term: string) => [...queryKeys.concepts.details(), term] as const,
    aiDefinition: (term: string) => [...queryKeys.concepts.all, 'ai-definition', term] as const,
    filtered: (params: any) => [...queryKeys.concepts.all, 'filter', params] as const,
  },

  // Stats
  stats: {
    all: ['stats'] as const,
    quick: () => [...queryKeys.stats.all, 'quick'] as const,
    reading: () => [...queryKeys.stats.all, 'reading'] as const,
    learning: () => [...queryKeys.stats.all, 'learning'] as const,
  },
} as const;

