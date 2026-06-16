import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export interface SettingsOption {
  id: number;
  label: string;
  value: string;
  isActive: boolean;
  sortOrder: number;
  parentId?: number | null;
  metadata?: Record<string, any> | null;
}

interface SettingItem {
  key: string;
  label: string;
  options: SettingsOption[];
}

// Settings data keyed by setting key (e.g. request_type, car_color)
type SettingsMap = Record<string, SettingsOption[]>;

export function useSettings() {
  return useQuery<SettingsMap>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/v1/settings');
      const data = response.data.data ?? response.data;
      const settings: SettingsMap = {};
      if (Array.isArray(data)) {
        for (const item of data as SettingItem[]) {
          settings[item.key] = item.options ?? [];
        }
      }
      // Debug: expose settings globally to verify data
      if (typeof window !== 'undefined') {
        (window as any).__settings = settings;
        (window as any).__settingsKeys = Object.keys(settings);
      }
      return settings;
    },
    staleTime: 0,
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
      parentId,
      metadata,
    }: {
      settingKey: string;
      label: string;
      value: string;
      parentId?: number;
      metadata?: Record<string, any>;
    }) => {
      const response = await api.post(`/v1/settings/${settingKey}/options`, {
        label,
        value,
        parentId,
        metadata,
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
      parentId,
      metadata,
    }: {
      settingKey: string;
      id: number;
      label: string;
      value: string;
      parentId?: number;
      metadata?: Record<string, any>;
    }) => {
      const response = await api.patch(
        `/v1/settings/${settingKey}/options/${id}`,
        { label, value, parentId, metadata }
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
      const orders = optionIds.map((id, index) => ({ id, sortOrder: index }));
      const response = await api.patch(
        `/v1/settings/${settingKey}/options/reorder`,
        { orders }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
