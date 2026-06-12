import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest } from '@/types/request';

export interface UpdateRequestPayload {
  requestType?: string;
  carNumber?: string;
  bodyNumber?: string;
  carColor?: string;
  carSpec?: string;
  clientName?: string;
  clientTel?: string;
  paymentMethod?: string;
  sellerId?: number;
  remarks?: string;
}

export function useUpdateRequest(requestId: number) {
  const queryClient = useQueryClient();

  return useMutation<CarRequest, Error, UpdateRequestPayload>({
    mutationFn: async (payload) => {
      const response = await api.patch(`/v1/requests/${requestId}`, payload);
      return response.data.data ?? response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
