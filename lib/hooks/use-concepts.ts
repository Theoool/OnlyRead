'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConceptStore } from '@/lib/store/useConceptStore'
import { queryKeys } from './use-articles'
import * as conceptsAPI from '@/lib/core/learning/concepts.service'
import { getCachedConcept, setCachedConcept } from '@/lib/cache'

/**
 * 获取所有概念卡片（使用Zustand store + React Query缓存）
 */
export function useConcepts() {
  const queryClient = useQueryClient()
  const { concepts, loadConcepts, loading } = useConceptStore()

  // 使用useQuery来管理加载状态和缓存
  const query = useQuery({
    queryKey: queryKeys.concepts,
    queryFn: async () => {
      await loadConcepts()
      return concepts
    },
    staleTime: 1000 * 60 * 5, // 5分钟
  })

  return {
    concepts: query.data || concepts,
    loading: query.isLoading || loading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * 获取待复习的概念卡片
 */
export function useDueConcepts() {
  return useQuery({
    queryKey: ['concepts', 'due'],
    queryFn: async () => {
      return conceptsAPI.getConcepts({ due: true, limit: 10 })
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

/**
 * 获取AI定义（带缓存）
 */
export function useAiDefinition(term: string | undefined) {
  return useQuery({
    queryKey: ['ai-definition', term],
    queryFn: async () => {
      if (!term) return null
      
      // 1. Check Local Cache
      const cached = getCachedConcept<any>(term)
      if (cached?.definition) return cached.definition

      // 2. Fetch from API
      const res = await fetch("/api/concept", {
          method: "POST",
          credentials: 'include',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selection: term }),
      })
      const data = await res.json()
      
      // 3. Update Local Cache
      if (data.definition) {
          setCachedConcept(term, data)
          return data.definition
      }
      return null
    },
    enabled: !!term,
    staleTime: Infinity,
  })
}

/**
 * 高级筛选概念
 */
export function useFilteredConcepts(params: {
  tags?: string[]
  mastered?: boolean | 'all'
  due?: boolean
  limit?: number
  sortBy?: 'recent' | 'name' | 'interval' | 'reviews'
}) {
  return useQuery({
    queryKey: ['concepts', 'filter', params],
    queryFn: () => conceptsAPI.filterConcepts(params),
    placeholderData: (previousData) => previousData,
  })
}

/**
 * 提交复习结果
 */
export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { id: string; quality: number }) =>
      conceptsAPI.submitReview(vars.id, vars.quality),
    onSuccess: () => {
      // Don't invalidate 'due' query to keep the current session stable
      queryClient.invalidateQueries({ queryKey: queryKeys.concepts })
    },
  })
}

/**
 * 添加概念卡片
 */
export function useAddConcept() {
  const { addConcept } = useConceptStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addConcept,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.concepts })
    },
  })
}

/**
 * 更新概念卡片
 */
export function useUpdateConcept() {
  const { updateConcept } = useConceptStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { term: string; data: Parameters<typeof updateConcept>[1]; id?: string }) =>
      updateConcept(vars.term, vars.data, vars.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.concepts })
    },
  })
}

/**
 * 删除概念卡片
 */
export function useDeleteConcept() {
  const { removeConcept } = useConceptStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { term: string; id?: string }) =>
      removeConcept(vars.term, vars.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.concepts })
    },
  })
}
