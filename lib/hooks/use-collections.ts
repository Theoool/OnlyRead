import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, deleteCollection, Collection } from '@/lib/core/reading/collections.service';
import { queryKeys } from './query-keys';

/**
 * 获取所有合集
 */
export function useCollections() {
  return useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: () => getCollections(),
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 删除合集
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: (_, deletedId) => {
      // 精确更新：移除详情缓存，刷新列表
      queryClient.removeQueries({ 
        queryKey: queryKeys.collections.detail(deletedId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.collections.lists() 
      })
      
      // 合集删除可能影响文章列表
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.articles.lists() 
      })
    },
  });
}
