import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export function ProtectedLayout() {
  const { isAuthenticated, isHydrated } = useAuthStore();

  // Don't redirect until auth state is hydrated from localStorage
  if (!isHydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
