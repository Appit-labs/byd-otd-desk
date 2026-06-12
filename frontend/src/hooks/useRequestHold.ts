import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export function useRequestHold(requestId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.patch(`/v1/requests/${requestId}/hold`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
