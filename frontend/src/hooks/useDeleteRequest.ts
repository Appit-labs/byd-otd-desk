import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export function useDeleteRequest(requestId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.delete(`/v1/requests/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
