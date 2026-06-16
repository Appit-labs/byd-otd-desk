import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest } from '@/types/request';

export interface UpdateRequestPayload {
  requestTypeId?: number;
  chassisNumber?: string;
  brandId?: number;
  modelId?: number;
  variantId?: number;
  cutId?: number;
  vehicleLocation?: string;
  customerName?: string;
  customerPhone?: string;
  salesConsultantId?: number;
  salesTypeId?: number;
  accessories?: number[];
  hasGps?: boolean;
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
