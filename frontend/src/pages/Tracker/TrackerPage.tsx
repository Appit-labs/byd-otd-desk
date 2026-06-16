import { useState, useCallback } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useRequests } from '@/hooks/useRequests';
import { useDepartments } from '@/hooks/useDepartments';
import type { RequestFilters } from '@/hooks/useRequests';
import { TrackerToolbar } from '@/components/tracker/TrackerToolbar';
import { TrackerTable } from '@/components/tracker/TrackerTable';
import { RequestFormDrawer } from '@/components/forms/RequestFormDrawer';
import type { CarRequest } from '@/types/request';
import styles from '@/components/tracker/tracker.module.css';

const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  requestNumber: true,
  chassisNumber: true,
  customerName: true,
  status: true,
  timeliness: true,
  progress: true,
};

export default function TrackerPage() {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? 'viewer';

  if (userRole === 'viewer') {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>You do not have access to the Tracker page.</p>
        </div>
      </div>
    );
  }

  return <TrackerPageInner userRole={userRole} />;
}

function TrackerPageInner({
  userRole,
}: {
  userRole: string;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [timeliness, setTimeliness] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const filters: RequestFilters = {
    page,
    limit,
    search: search || undefined,
    status: (status as RequestFilters['status']) || undefined,
    timeliness: (timeliness as RequestFilters['timeliness']) || undefined,
    departmentId: departmentId ? Number(departmentId) : undefined,
  };

  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
  } = useRequests(filters);

  const {
    data: departments = [],
    isLoading: isDepartmentsLoading,
    error: departmentsError,
  } = useDepartments();

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CarRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const requests = requestsData?.items ?? [];
  const total = requestsData?.total ?? 0;
  const queryError = requestsError || departmentsError;

  const handleFiltersChange = useCallback(
    (newFilters: RequestFilters) => {
      if (newFilters.page !== undefined) setPage(newFilters.page);
      if (newFilters.limit !== undefined) setLimit(newFilters.limit);
      if (newFilters.search !== undefined) setSearch(newFilters.search);
      if (newFilters.status !== undefined) setStatus(newFilters.status ?? '');
      if (newFilters.timeliness !== undefined) setTimeliness(newFilters.timeliness ?? '');
      if (newFilters.departmentId !== undefined) {
        setDepartmentId(
          newFilters.departmentId ? String(newFilters.departmentId) : ''
        );
      }
    },
    []
  );

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 6000);
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleColumnToggle = useCallback((column: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [column]: prev[column] !== false ? false : true,
    }));
  }, []);

  const handleNewRequest = useCallback(() => {
    setEditingRequest(null);
    setIsDrawerOpen(true);
  }, []);

  const handleEditRequest = useCallback((request: CarRequest) => {
    setEditingRequest(request);
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setTimeout(() => setEditingRequest(null), 300);
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Tracker</h1>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button
            className={styles.errorDismiss}
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {queryError && !errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>
            Failed to load data:{' '}
            {queryError instanceof Error ? queryError.message : 'Unknown error'}.{' '}
            Try refreshing the page.
          </span>
        </div>
      )}

      <TrackerToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1); }}
        timeliness={timeliness}
        onTimelinessChange={(v) => { setTimeliness(v); setPage(1); }}
        departmentId={departmentId}
        onDepartmentChange={(v) => { setDepartmentId(v); setPage(1); }}
        departments={departments}
        userRole={userRole}
        columnVisibility={columnVisibility}
        onColumnToggle={handleColumnToggle}
        onNewRequest={handleNewRequest}
        onError={showError}
      />

      <TrackerTable
        requests={requests}
        isLoading={isRequestsLoading || isDepartmentsLoading}
        total={total}
        page={page}
        limit={limit}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        userRole={userRole}
        onEditRequest={handleEditRequest}
      />

      <RequestFormDrawer
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        editingRequest={editingRequest}
        onToast={showToast}
      />

      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--spacing-6)',
            right: 'var(--spacing-6)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-sm)',
            zIndex: 'var(--z-toast)',
            animation: 'fadeIn 150ms ease-out',
            maxWidth: '400px',
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              style={{
                display: 'flex',
                padding: 0,
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                marginLeft: 'var(--spacing-2)',
              }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
