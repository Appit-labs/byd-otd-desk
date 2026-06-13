import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest } from '@/types/request';

export interface CreateRequestPayload {
  requestTypeId: number;
  carNumber: string;
  bodyNumber?: string;
  carColorId?: number;
  carSpecId?: number;
  clientName: string;
  clientTel: string;
  paymentMethodId: number;
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
