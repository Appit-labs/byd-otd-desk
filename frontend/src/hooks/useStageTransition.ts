import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface TransitionParams {
  requestId: number;
  departmentId: number;
  action: 'started' | 'completed';
}

interface BulkTransitionParams {
  requestIds: number[];
  departmentId: number;
  action: 'started' | 'completed';
}

interface TransitionResult {
  success: boolean;
  requestId: number;
  error?: string;
}

export function useStageTransition() {
  const queryClient = useQueryClient();

  const singleMutation = useMutation<TransitionResult, Error, TransitionParams>({
    mutationFn: async ({ requestId, departmentId, action }) => {
      await api.post(`/v1/requests/${requestId}/transition`, {
        departmentId,
        action,
      });
      return { success: true, requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  const bulkMutation = useMutation<TransitionResult[], Error, BulkTransitionParams>({
    mutationFn: async ({ requestIds, departmentId, action }) => {
      const response = await api.post('/v1/requests/bulk-transition', {
        requestIds,
        departmentId,
        action,
      });
      const body = response.data;
      return (body.data ?? body.results ?? []).map(
        (r: { requestId: number; success?: boolean; error?: string }) => ({
          success: r.success ?? true,
          requestId: r.requestId,
          error: r.error,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  return {
    transition: singleMutation.mutateAsync,
    bulkTransition: bulkMutation.mutateAsync,
    isLoading: singleMutation.isPending,
    isBulkLoading: bulkMutation.isPending,
    error: singleMutation.error,
    bulkError: bulkMutation.error,
  };
}
