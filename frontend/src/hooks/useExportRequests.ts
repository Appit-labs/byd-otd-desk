import { useMutation } from '@tanstack/react-query';
import api from '@/services/api';

export function useExportRequests() {
  return useMutation({
    mutationFn: async (period: string) => {
      const response = await api.get('/v1/requests/export', {
        params: { period },
        responseType: 'blob',
      });
      return response.data as Blob;
    },
  });
}
