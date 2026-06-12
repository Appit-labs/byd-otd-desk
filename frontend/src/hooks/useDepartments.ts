import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { Department } from '@/types/request';

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get('/v1/departments');
      return response.data.data ?? response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
