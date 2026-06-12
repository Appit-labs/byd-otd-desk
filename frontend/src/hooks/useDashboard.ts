import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

// ── Types ────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
  trend: number;
}

export interface ComparisonDay {
  day: number;
  currentMonth: number;
  previousMonth: number;
}

export interface DashboardComparison {
  days: ComparisonDay[];
}

export interface PipelineStage {
  departmentName: string;
  slug: string;
  pipelineOrder: number;
  count: number;
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useDashboardStats(period: 'daily' | 'monthly') {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', period],
    queryFn: async () => {
      const response = await api.get('/v1/dashboard/stats', {
        params: { period },
      });
      const body = response.data;
      return (body.data ?? body) as DashboardStats;
    },
  });
}

export function useDashboardComparison(month: string) {
  return useQuery<DashboardComparison>({
    queryKey: ['dashboard-comparison', month],
    queryFn: async () => {
      const response = await api.get('/v1/dashboard/comparison', {
        params: { month },
      });
      const body = response.data;
      return (body.data ?? body) as DashboardComparison;
    },
    // Comparison data changes infrequently
    staleTime: 5 * 60 * 1000,
  });
}

export function usePipelineSummary() {
  return useQuery<PipelineStage[]>({
    queryKey: ['pipeline-summary'],
    queryFn: async () => {
      const response = await api.get('/v1/dashboard/pipeline-summary');
      const body = response.data;
      const unwrapped = body.data ?? body;
      // Backend returns { stages: [...] }, extract the array
      return (unwrapped.stages ?? unwrapped) as PipelineStage[];
    },
  });
}
