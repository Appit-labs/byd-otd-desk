import { create } from 'zustand';
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
      const response = await api.post('/auth/v1/login', {
        department,
        username,
        password,
      });

      const { accessToken, user } = response.data;

      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        user,
        token: accessToken,
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
