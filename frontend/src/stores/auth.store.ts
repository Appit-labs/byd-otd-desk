import { create } from 'zustand';
import { z } from 'zod';
import type { User, UserRole } from '@/types';
import api from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });

    try {
      // The backend LoginDto expects { username, password, departmentId? }
      // departmentId is optional — will fallback to user's own department if omitted
      const response = await api.post('/v1/auth/login', {
        username,
        password,
      });

      // Response is wrapped by interceptor: { success, data: { access_token, user } }
      const body = response.data.data ?? response.data;

      const { access_token, user: rawUser } = body;

      const loginResponseSchema = z.object({
        access_token: z.string(),
        user: z.object({
          id: z.number(),
          username: z.string().optional(),
          full_name: z.string().optional(),
          role: z.custom<UserRole>(),
          department_id: z.number().optional().nullable(),
        }),
      });

      const validated = loginResponseSchema.parse({ access_token, user: rawUser });

      // Normalize snake_case to camelCase for the frontend
      const user: User = {
        id: validated.user.id,
        username: validated.user.username || validated.user.full_name || '',
        fullName: validated.user.full_name,
        role: validated.user.role,
        department_id: validated.user.department_id ?? undefined,
        department: validated.user.full_name ?? '',
      };

      localStorage.setItem('auth_token', validated.access_token);
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        user,
        token: validated.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('login_department');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },

  hydrate: () => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({
          user,
          token,
          isAuthenticated: true,
          isHydrated: true,
        });
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: true,
        });
      }
    } else {
      set({ isHydrated: true });
    }
  },
}));

export function getRoleBasedDefaultPath(role?: UserRole): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/dashboard';
    case 'nvs':
    case 'qc_nvs':
    case 'mechanical_check':
    case 'pdi':
    case 'accessories':
    case 'registration':
    case 'delivery':
      return '/tracker';
    case 'viewer':
      return '/preview';
    default:
      return '/login';
  }
}
