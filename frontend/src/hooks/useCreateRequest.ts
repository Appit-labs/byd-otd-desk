import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest } from '@/types/request';

export interface CreateRequestPayload {
  requestType: string;
  carNumber: string;
  bodyNumber?: string;
  carColor?: string;
  carSpec?: string;
  clientName: string;
  clientTel: string;
  paymentMethod: string;
  sellerId: number;
  remarks?: string;
  createdAt?: string;
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation<CarRequest, Error, CreateRequestPayload>({
    mutationFn: async (payload) => {
      const response = await api.post('/v1/requests', payload);
      return response.data.data ?? response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
