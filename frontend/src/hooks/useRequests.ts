import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest, PaginationMeta, RequestStatus } from '@/types/request';

export interface RequestFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: RequestStatus;
  departmentId?: number;
  dateFrom?: string;
  dateTo?: string;
  requestTypeId?: number;
  sellerId?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface RequestsResponse {
  items: CarRequest[];
  total: number;
  page: number;
  limit: number;
}

export function useRequests(
  filters: RequestFilters = {},
  queryOptions?: Partial<UseQueryOptions<RequestsResponse>>,
) {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    departmentId,
    dateFrom,
    dateTo,
    requestTypeId,
    sellerId,
    sortBy,
    sortOrder,
  } = filters;

  return useQuery<RequestsResponse>({
    queryKey: ['requests', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page) params.set('page', String(page));
      if (limit) params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (departmentId) params.set('departmentId', String(departmentId));
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (requestTypeId) params.set('requestTypeId', String(requestTypeId));
      if (sellerId) params.set('sellerId', String(sellerId));
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);

      const response = await api.get(`/v1/requests?${params.toString()}`);

      const body = response.data;
      const items: CarRequest[] = body.data ?? body.items ?? [];
      const meta: PaginationMeta | undefined = body.metadata;

      return {
        items,
        total: meta?.total ?? body.total ?? items.length,
        page: meta?.page ?? body.page ?? page,
        limit: meta?.limit ?? body.limit ?? limit,
      };
    },
    placeholderData: (previousData) => previousData,
    ...queryOptions,
  });
}
