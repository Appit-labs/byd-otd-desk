import { create } from 'zustand';
import { z } from 'zod';
import type { User, UserRole } from '@/types';
import api from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (department: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (department: string, username: string, password: string) => {
    set({ isLoading: true });

    try {
      const response = await api.post('/v1/auth/login', {
        department,
        username,
        password,
      });

      const { accessToken, user } = response.data;

      const loginResponseSchema = z.object({
        accessToken: z.string(),
        user: z.object({
          id: z.number(),
          username: z.string(),
          full_name: z.string().optional(),
          role: z.custom<UserRole>(),
          department: z.string(),
          department_id: z.number().optional(),
        }),
      });

      const validated = loginResponseSchema.parse({ accessToken, user });

      localStorage.setItem('auth_token', validated.accessToken);
      localStorage.setItem('auth_user', JSON.stringify(validated.user));

      set({
        user: validated.user,
        token: validated.accessToken,
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
        });
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      }
    }
  },
}));

export function getRoleBasedDefaultPath(role?: UserRole): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/dashboard';
    case 'department_user':
      return '/tracker';
    case 'viewer':
      return '/preview';
    default:
      return '/login';
  }
}
