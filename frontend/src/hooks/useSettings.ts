import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export interface SettingsOption {
  id: number;
  label: string;
  value: string;
  is_active: boolean;
  sort_order: number;
}

interface SettingsResponse {
  requestTypes: SettingsOption[];
  carColors: SettingsOption[];
  carSpecs: SettingsOption[];
  paymentMethods: SettingsOption[];
}

export function useSettings() {
  return useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/v1/settings');
      return response.data.data ?? response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// -- Mutation hooks --

export function useAddOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settingKey,
      label,
      value,
    }: {
      settingKey: string;
      label: string;
      value: string;
    }) => {
      const response = await api.post(`/v1/settings/${settingKey}/options`, {
        label,
        value,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useEditOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settingKey,
      id,
      label,
      value,
    }: {
      settingKey: string;
      id: number;
      label: string;
      value: string;
    }) => {
      const response = await api.patch(
        `/v1/settings/${settingKey}/options/${id}`,
        { label, value }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useDeprecateOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settingKey,
      id,
    }: {
      settingKey: string;
      id: number;
    }) => {
      const response = await api.patch(
        `/v1/settings/${settingKey}/options/${id}/deprecate`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useRestoreOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settingKey,
      id,
    }: {
      settingKey: string;
      id: number;
    }) => {
      const response = await api.patch(
        `/v1/settings/${settingKey}/options/${id}/restore`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useReorderOptions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settingKey,
      optionIds,
    }: {
      settingKey: string;
      optionIds: number[];
    }) => {
      const response = await api.patch(
        `/v1/settings/${settingKey}/options/reorder`,
        { optionIds }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
