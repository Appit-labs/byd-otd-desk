import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

// ── Types ────────────────────────────────────────────────────────────────

export interface ReportsSummary {
  totalRequests: number;
  avgPdiDurationSeconds: number;
  avgAccessoriesDurationSeconds: number;
  pdiTargetSeconds: number;
  accessoriesTargetSeconds: number;
}

export interface AvgDurationPoint {
  period: string;
  avgDurationSeconds: number;
  count: number;
}

export interface AvgDurationResponse {
  data: AvgDurationPoint[];
  targetSeconds: number;
}

export interface BrandCountPoint {
  period: string;
  brand: string;
  count: number;
}

export interface GroupedCount {
  name: string;
  count: number;
}

/** Convert seconds to days (1 decimal) for display */
export function secondsToDays(seconds: number): number {
  return Math.round((seconds / 86400) * 10) / 10;
}

// ── Hooks ────────────────────────────────────────────────────────────────

export function useReportsSummary(month?: string) {
  return useQuery<ReportsSummary>({
    queryKey: ['reports-summary', month],
    queryFn: async () => {
      const response = await api.get('/v1/reports/summary', {
        params: month ? { month } : undefined,
      });
      const body = response.data;
      return (body.data ?? body) as ReportsSummary;
    },
  });
}

export function usePdiAvgDuration(period: 'monthly' | 'daily' = 'monthly') {
  return useQuery<AvgDurationResponse>({
    queryKey: ['reports-pdi-avg', period],
    queryFn: async () => {
      const response = await api.get('/v1/reports/pdi-avg-duration', {
        params: { period },
      });
      const body = response.data;
      return (body.data ?? body) as AvgDurationResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccessoriesAvgDuration(
  period: 'monthly' | 'daily' = 'monthly',
) {
  return useQuery<AvgDurationResponse>({
    queryKey: ['reports-acc-avg', period],
    queryFn: async () => {
      const response = await api.get(
        '/v1/reports/accessories-avg-duration',
        { params: { period } },
      );
      const body = response.data;
      return (body.data ?? body) as AvgDurationResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequestsByBrand(
  granularity: 'monthly' | 'daily' = 'monthly',
) {
  return useQuery<BrandCountPoint[]>({
    queryKey: ['reports-by-brand', granularity],
    queryFn: async () => {
      const response = await api.get('/v1/reports/requests-by-brand', {
        params: { granularity },
      });
      const body = response.data;
      return (body.data ?? body) as BrandCountPoint[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequestsByType() {
  return useQuery<GroupedCount[]>({
    queryKey: ['reports-by-type'],
    queryFn: async () => {
      const response = await api.get('/v1/reports/requests-by-type');
      const body = response.data;
      return (body.data ?? body) as GroupedCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequestsByModel() {
  return useQuery<GroupedCount[]>({
    queryKey: ['reports-by-model'],
    queryFn: async () => {
      const response = await api.get('/v1/reports/requests-by-model');
      const body = response.data;
      return (body.data ?? body) as GroupedCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequestsByConsultant() {
  return useQuery<GroupedCount[]>({
    queryKey: ['reports-by-consultant'],
    queryFn: async () => {
      const response = await api.get('/v1/reports/requests-by-consultant');
      const body = response.data;
      return (body.data ?? body) as GroupedCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
