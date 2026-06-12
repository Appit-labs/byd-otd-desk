import { useState, useCallback } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useRequests } from '@/hooks/useRequests';
import { useDepartments } from '@/hooks/useDepartments';
import { useStageTransition } from '@/hooks/useStageTransition';
import type { RequestFilters } from '@/hooks/useRequests';
import { TrackerToolbar } from '@/components/tracker/TrackerToolbar';
import { TrackerTable } from '@/components/tracker/TrackerTable';
import { BulkActionBar } from '@/components/tracker/BulkActionBar';
import { RequestFormDrawer } from '@/components/forms/RequestFormDrawer';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { CarRequest, Department } from '@/types/request';
import styles from '@/components/tracker/tracker.module.css';

const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  requestNumber: true,
  carNumber: true,
  clientName: true,
  status: true,
  progress: true,
};

export default function TrackerPage() {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? 'viewer';
  const userDepartmentId = user?.department_id;

  // Redirect viewers
  if (userRole === 'viewer') {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>You do not have access to the Tracker page.</p>
        </div>
      </div>
    );
  }

  return <TrackerPageInner userRole={userRole} userDepartmentId={userDepartmentId} />;
}

function TrackerPageInner({
  userRole,
  userDepartmentId,
}: {
  userRole: string;
  userDepartmentId: number | undefined;
}) {
  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const filters: RequestFilters = {
    page,
    limit,
    search: search || undefined,
    status: (status as RequestFilters['status']) || undefined,
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

  const { transition, bulkTransition } = useStageTransition();

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Error toast
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CarRequest | null>(null);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Track loading per-request
  const [loadingRequestId, setLoadingRequestId] = useState<number | null>(null);

  // Bulk loading
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const requests = requestsData?.items ?? [];
  const total = requestsData?.total ?? 0;

  const queryError = requestsError || departmentsError;

  const handleFiltersChange = useCallback(
    (newFilters: RequestFilters) => {
      if (newFilters.page !== undefined) setPage(newFilters.page);
      if (newFilters.limit !== undefined) setLimit(newFilters.limit);
      if (newFilters.search !== undefined) setSearch(newFilters.search);
      if (newFilters.status !== undefined) setStatus(newFilters.status ?? '');
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
    // Auto-dismiss after 6 seconds
    setTimeout(() => setErrorMessage(null), 6000);
  }, []);

  const handleTransition = useCallback(
    (requestId: number, deptId: number, action: 'started' | 'completed') => {
      const request = requests.find((r: CarRequest) => r.id === requestId);
      const dept = departments.find((d: Department) => d.id === deptId);

      const actionLabel = action === 'started' ? 'start' : 'complete';
      const deptName = dept?.name ?? `Department #${deptId}`;
      const reqLabel = request?.requestNumber ?? `Request #${requestId}`;

      setConfirmModal({
        open: true,
        title: `Confirm ${actionLabel === 'start' ? 'Start' : 'Complete'}`,
        message: `Are you sure you want to ${actionLabel} "${deptName}" for ${reqLabel}?`,
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, open: false }));
          setLoadingRequestId(requestId);
          try {
            await transition({ requestId, departmentId: deptId, action });
          } catch (err) {
            showError(
              `Transition failed: ${
                err instanceof Error ? err.message : 'Unknown error'
              }`
            );
          } finally {
            setLoadingRequestId(null);
          }
        },
      });
    },
    [requests, departments, transition, showError]
  );

  const handleBulkTransition = useCallback(
    async (deptId: number, action: 'started' | 'completed') => {
      const requestIds = Array.from(selectedIds);
      setIsBulkLoading(true);
      try {
        await bulkTransition({
          requestIds,
          departmentId: deptId,
          action,
        });
        setSelectedIds(new Set());
      } catch (err) {
        showError(
          `Bulk transition failed: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      } finally {
        setIsBulkLoading(false);
      }
    },
    [selectedIds, bulkTransition, showError]
  );

  const handleSelectId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === requests.length && requests.length > 0) {
        return new Set();
      }
      return new Set(requests.map((r: CarRequest) => r.id));
    });
  }, [requests]);

  const handleColumnToggle = useCallback((column: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [column]: prev[column] !== false ? false : true,
    }));
  }, []);

  const handleShowToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
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
    // Small delay to ensure animation plays before clearing data
    setTimeout(() => setEditingRequest(null), 300);
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Tracker</h1>

      {/* Error Banner */}
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

      {/* Query error banner (persistent until refetch) */}
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
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        departmentId={departmentId}
        onDepartmentChange={(v) => {
          setDepartmentId(v);
          setPage(1);
        }}
        departments={departments}
        userRole={userRole}
        columnVisibility={columnVisibility}
        onColumnToggle={handleColumnToggle}
        onNewRequest={handleNewRequest}
      />

      <TrackerTable
        requests={requests}
        departments={departments}
        isLoading={isRequestsLoading || isDepartmentsLoading}
        total={total}
        page={page}
        limit={limit}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onTransition={handleTransition}
        loadingRequestId={loadingRequestId}
        userDepartmentId={userDepartmentId}
        userRole={userRole}
        columnVisibility={columnVisibility}
        selectedIds={selectedIds}
        onSelectId={handleSelectId}
        onSelectAll={handleSelectAll}
        onEditRequest={handleEditRequest}
      />

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          departments={departments}
          requests={requests.filter((r) => selectedIds.has(r.id))}
          onCancel={() => setSelectedIds(new Set())}
          onBulkAction={handleBulkTransition}
          isLoading={isBulkLoading}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        title={confirmModal.title}
      >
        <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
          {confirmModal.message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmModal.onConfirm}
          >
            Confirm
          </Button>
        </div>
      </Modal>

      {/* Request Form Drawer */}
      <RequestFormDrawer
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        editingRequest={editingRequest}
        onToast={handleShowToast}
      />

      {/* Toast Notification */}
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
