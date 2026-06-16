import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/Login/LoginPage';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import TrackerPage from '@/pages/Tracker/TrackerPage';
import PreviewPage from '@/pages/Preview/PreviewPage';
import SettingsPage from '@/pages/Settings/SettingsPage';
import ReportsPage from '@/pages/Reports/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={getRoleBasedDefaultPath(user?.role)} replace />;
}

function HydrateAuth({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HydrateAuth>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tracker" element={<TrackerPage />} />
                <Route path="/preview" element={<PreviewPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </HydrateAuth>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
