import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollections, deleteCollection } from '@/lib/core/reading/collections.service';

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => getCollections(),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] }); // Articles might be deleted too
    },
  });
}
