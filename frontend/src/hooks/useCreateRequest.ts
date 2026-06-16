import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest } from '@/types/request';

export interface CreateRequestPayload {
  requestTypeId: number;
  chassisNumber: string;
  brandId?: number;
  modelId?: number;
  variantId?: number;
  cutId?: number;
  vehicleLocation?: string;
  customerName: string;
  customerPhone: string;
  salesConsultantId: number;
  salesTypeId?: number;
  accessories?: number[];
  hasGps?: boolean;
  remarks?: string;
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
