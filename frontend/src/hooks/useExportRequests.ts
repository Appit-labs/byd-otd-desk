import { useMutation } from '@tanstack/react-query';
import api from '@/services/api';

export function useExportRequests() {
  return useMutation({
    mutationFn: async ({ period, format = 'csv' }: { period: string; format?: 'csv' | 'xlsx' }) => {
      const endpoint = format === 'xlsx' ? '/v1/requests/export-xlsx' : '/v1/requests/export';
      const response = await api.get(endpoint, {
        params: { period },
        responseType: 'blob',
      });
      return { blob: response.data as Blob, format };
    },
  });
}
