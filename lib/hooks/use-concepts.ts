'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConceptData } from '@/lib/store/useConceptStore'
import { queryKeys } from './query-keys'
import * as conceptsAPI from '@/lib/core/learning/concepts.service'

// Simple localStorage cache helpers (moved from deleted lib/cache.ts)
const CACHE_PREFIX = "concept_cache_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedConcept<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    
    const item = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - item.timestamp > CACHE_TTL) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return item.data;
  } catch {
    return null;
  }
}

function setCachedConcept<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    const item = {
      data,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    console.warn("Failed to cache concept:", e);
  }
}

/**
 * 获取所有概念卡片（纯 React Query，移除 Zustand 双重状态）
 */
export function useConcepts(options: { limit?: number } = {}) {
  const { limit = 1000 } = options;
  
  return useQuery({
    queryKey: queryKeys.concepts.list({ limit }),
    queryFn: () => conceptsAPI.getConcepts({ limit }),
    staleTime: 1000 * 60 * 5, // 5分钟
    select: (concepts) => {
      // 转换为 Record 格式，方便查找
      const conceptsRecord: Record<string, ConceptData> = {}
      concepts.forEach((concept) => {
        if (concept.term) {
          conceptsRecord[concept.term] = concept
        }
      })
      return { concepts: conceptsRecord, list: concepts }
    },
  })
}

/**
 * 获取AI定义（带缓存）
 */
export function useAiDefinition(term: string | undefined) {
  return useQuery({
    queryKey: queryKeys.concepts.aiDefinition(term || ''),
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
      
      if (!res.ok) throw new Error('Failed to fetch AI definition')
      
      const data = await res.json()
      
      // 3. Update Local Cache
      if (data.definition) {
          setCachedConcept(term, data)
          return data.definition
      }
      return null
    },
    enabled: !!term,
    staleTime: Infinity, // AI 定义不会变化，永久缓存
    retry: 2,
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
    queryKey: queryKeys.concepts.filtered(params),
    queryFn: () => conceptsAPI.filterConcepts(params),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60, // 1分钟
  })
}

/**
 * 添加概念卡片
 */
export function useAddConcept() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (concept: ConceptData) => conceptsAPI.createConcept(concept),
    onSuccess: (newConcept) => {
      // 精确更新：刷新概念列表
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.concepts.lists() 
      })
      
      // 乐观更新：直接添加到缓存
      queryClient.setQueryData(
        queryKeys.concepts.detail(newConcept.term),
        newConcept
      )
    },
  })
}

/**
 * 更新概念卡片
 */
export function useUpdateConcept() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ConceptData> }) =>
      conceptsAPI.updateConcept(id, data),
    onSuccess: (updatedConcept) => {
      // 精确更新：刷新列表和详情
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.concepts.lists() 
      })
      
      if (updatedConcept.term) {
        queryClient.setQueryData(
          queryKeys.concepts.detail(updatedConcept.term),
          updatedConcept
        )
      }
    },
  })
}

/**
 * 删除概念卡片
 */
export function useDeleteConcept() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, term }: { id: string; term: string }) =>
      conceptsAPI.deleteConcept(id),
    onSuccess: (_, variables) => {
      // 精确更新：移除缓存，刷新列表
      queryClient.removeQueries({ 
        queryKey: queryKeys.concepts.detail(variables.term) 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.concepts.lists() 
      })
    },
  })
}
