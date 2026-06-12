import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { User } from '@/types/auth';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/v1/users');
      return response.data.data ?? response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// -- Mutation hooks --

export interface CreateUserPayload {
  username: string;
  fullName: string;
  password: string;
  role: string;
  departmentId?: number;
}

export interface UpdateUserPayload {
  id: number;
  username?: string;
  fullName?: string;
  password?: string;
  role?: string;
  departmentId?: number;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserPayload) => {
      const response = await api.post('/v1/users', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateUserPayload) => {
      const response = await api.patch(`/v1/users/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: number;
      isActive: boolean;
    }) => {
      const response = await api.patch(`/v1/users/${id}/status`, {
        is_active: isActive,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
