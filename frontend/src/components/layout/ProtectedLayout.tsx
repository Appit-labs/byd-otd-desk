import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';

export function ProtectedLayout() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user is at root "/" (or any protected path) and we have their role,
  // the AppShell-level redirect will handle it.
  // But if somehow they hit a path their role can't access,
  // redirect to their default.
  if (user && !user.role) {
    return <Navigate to={getRoleBasedDefaultPath(user.role)} replace />;
  }

  return <Outlet />;
}
