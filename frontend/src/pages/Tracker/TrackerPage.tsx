import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useRequests } from '@/hooks/useRequests';
import { useDepartments } from '@/hooks/useDepartments';
import type { RequestFilters } from '@/hooks/useRequests';
import { useStageActions } from '@/hooks/useStageActions';
import { useSettings, type SettingsOption } from '@/hooks/useSettings';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TrackerToolbar } from '@/components/tracker/TrackerToolbar';
import { TrackerTable } from '@/components/tracker/TrackerTable';
import { SelectedRequestActions } from '@/components/tracker/SelectedRequestActions';
import { RequestFormDrawer } from '@/components/forms/RequestFormDrawer';
import type { CarRequest } from '@/types/request';
import { PipelineStage } from '@/types/request';
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

/** Map stage slugs used by TrackerTable to PipelineStage enum values. */
const SLUG_TO_STAGE: Record<string, PipelineStage> = {
  storage: PipelineStage.STORAGE,
  vehicle_received: PipelineStage.SHOWROOM,
  mechanical_check: PipelineStage.MECHANICAL_CHECK,
  pdi: PipelineStage.PDI,
  sent_to_accessories: PipelineStage.SENT_TO_ACCESSORIES,
  accessories: PipelineStage.ACCESSORIES,
  final_inspection: PipelineStage.FINAL_INSPECTION,
  gps: PipelineStage.GPS,
  registration: PipelineStage.REGISTRATION,
  delivery: PipelineStage.DELIVERY,
};

/** Normalise TrackerTable action strings to useStageActions-compatible actions. */
function normalizeAction(action: string): 'start' | 'complete' | 'confirm' {
  switch (action) {
    case 'dispatch':
    case 'receive':
    case 'register':
      return 'confirm';
    case 'start':
    case 'complete':
    case 'confirm':
      return action;
    default:
      return 'confirm';
  }
}

const STAGE_LABELS: Record<string, string> = {
  storage: 'Storage',
  vehicle_received: 'Vehicle Received',
  mechanical_check: 'Mechanical Check',
  pdi: 'PDI',
  sent_to_accessories: 'Sent to Accessories',
  accessories: 'Accessories',
  gps: 'GPS',
  registration: 'Registration',
  delivery: 'Delivery',
};

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

  const { executeAction } = useStageActions();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();

  const fiOutcomes = useMemo(() => {
    const rawOptions = (settings as Record<string, SettingsOption[]> | undefined)?.['final_inspection'] ?? [];
    return rawOptions
      .filter((o) => o.isActive)
      .map((o) => ({
        value: o.label,
        label: o.label,
        type: (o.metadata?.outcome_behavior === 'archive' ? 'archive' : 'done') as 'done' | 'archive',
      }));
  }, [settings]);

  const [fiModalOpen, setFiModalOpen] = useState(false);
  const [fiModalRequestId, setFiModalRequestId] = useState<number | null>(null);

  // Confirmation modal for stage actions
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    requestId: number;
    stage: string;
    action: string;
    label: string;
  } | null>(null);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CarRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  const handleSelectId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === requests.length && requests.length > 0) return new Set();
      return new Set(requests.map((r: CarRequest) => r.id));
    });
  }, [requests]);

  const handleStageAction = useCallback(
    async (requestId: number, stage: string, action: string, skipConfirm?: boolean) => {
      const stageEnum = SLUG_TO_STAGE[stage];
      if (stageEnum === undefined) return;

      // Final Inspection needs special handling — open modal
      if (stageEnum === PipelineStage.FINAL_INSPECTION && action === 'open_modal') {
        setFiModalRequestId(requestId);
        setFiModalOpen(true);
        return;
      }

      if (skipConfirm) {
        // Called from SelectedRequestActions (has its own confirmation)
        await doExecuteAction(requestId, stageEnum, normalizeAction(action));
        return;
      }

      // Show confirmation modal first
      const stageLabel = STAGE_LABELS[stage] ?? stage;
      setConfirmAction({ requestId, stage, action, label: `${action} — ${stageLabel}` });
      setConfirmOpen(true);
    },
    [executeAction, showError, showToast],
  );

  const doExecuteAction = useCallback(async (
    requestId: number,
    stageEnum: PipelineStage,
    action: 'start' | 'complete' | 'confirm',
  ) => {
    try {
      await executeAction({ requestId, stage: stageEnum, action });
      showToast('Action completed successfully');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Auto-refresh on stage mismatch — frontend data is stale
      if (msg.includes('not at the correct stage') || msg.includes('current stage')) {
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        showError('Request state changed. Data refreshed — please try again.');
      } else {
        showError(`Action failed: ${msg}`);
      }
    }
  }, [executeAction, showError, showToast, queryClient]);

  const executeConfirmedAction = useCallback(async () => {
    if (!confirmAction) return;
    const { requestId, stage, action } = confirmAction;
    const stageEnum = SLUG_TO_STAGE[stage];
    if (stageEnum === undefined) return;
    setConfirmOpen(false);
    setConfirmAction(null);
    await doExecuteAction(requestId, stageEnum, normalizeAction(action));
  }, [confirmAction, doExecuteAction]);

  const handleFinalInspectionSubmit = useCallback(
    async (outcome: string, remarks?: string) => {
      if (!fiModalRequestId) return;
      const requestId = fiModalRequestId;
      setFiModalOpen(false);
      setFiModalRequestId(null);

      try {
        await api.post(`/v1/requests/${requestId}/final-inspection`, { outcome, remarks });
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        showToast('Final inspection submitted');
      } catch (err) {
        showError(`Final inspection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [fiModalRequestId, showError, showToast, queryClient],
  );

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

      {selectedIds.size === 1 && (() => {
        const selectedRequest = requests.find((r) => r.id === [...selectedIds][0]);
        if (!selectedRequest) return null;
        return (
          <SelectedRequestActions
            request={selectedRequest}
            onStageAction={(id, stage, action) => handleStageAction(id, stage, action, true)}
          />
        );
      })()}

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
        onStageAction={handleStageAction}
        selectedIds={selectedIds}
        onSelectId={handleSelectId}
        onSelectAll={handleSelectAll}
      />

      <Modal
        open={fiModalOpen}
        onClose={() => { setFiModalOpen(false); setFiModalRequestId(null); }}
        title="Final Inspection"
      >
        <FinalInspectionForm
          outcomes={fiOutcomes}
          onSubmit={handleFinalInspectionSubmit}
          onCancel={() => { setFiModalOpen(false); setFiModalRequestId(null); }}
        />
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmAction(null); }}
        title="Confirm Action"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
            Are you sure you want to <strong>{confirmAction?.label}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => { setConfirmOpen(false); setConfirmAction(null); }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={executeConfirmedAction}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <RequestFormDrawer
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        editingRequest={editingRequest}
        onToast={showToast}
        userRole={userRole}
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

// ── Final Inspection Form Component ─────────────────────────────

interface FiOutcome {
  value: string;
  label: string;
  type: 'done' | 'archive';
}

const FALLBACK_FI_OUTCOMES: FiOutcome[] = [
  { value: 'Good condition', label: 'Good condition', type: 'done' },
  { value: 'Release as is', label: 'Release as is', type: 'done' },
  { value: 'Sales team / manager to check', label: 'Sales team / manager to check', type: 'done' },
  { value: 'Return to fin', label: 'Return to fin', type: 'archive' },
  { value: 'Return the car (take time)', label: 'Return the car (take time)', type: 'archive' },
];

function FinalInspectionForm({
  outcomes: outcomesProp,
  onSubmit,
  onCancel,
}: {
  outcomes?: FiOutcome[];
  onSubmit: (outcome: string, remarks?: string) => void;
  onCancel: () => void;
}) {
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [remarks, setRemarks] = useState('');

  const outcomes = (outcomesProp && outcomesProp.length > 0) ? outcomesProp : FALLBACK_FI_OUTCOMES;

  const handleSubmit = () => {
    if (!selectedOutcome) return;
    onSubmit(selectedOutcome, remarks || undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        Select the final inspection outcome:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
        {outcomes.map((o) => (
          <label
            key={o.value}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)',
              padding: 'var(--spacing-2) var(--spacing-3)',
              border: selectedOutcome === o.value ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              backgroundColor: selectedOutcome === o.value ? 'var(--color-primary-light)' : 'transparent',
              fontSize: 'var(--text-sm)',
            }}
          >
            <input type="radio" name="fi-outcome" value={o.value}
              checked={selectedOutcome === o.value}
              onChange={() => setSelectedOutcome(o.value)}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <span style={{ flex: 1 }}>{o.label}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: o.type === 'archive' ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 500 }}>
              {o.type === 'archive' ? 'Archives' : 'Proceeds'}
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>Remarks (optional)</label>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add any remarks about the inspection..." rows={3}
          style={{ padding: 'var(--spacing-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', resize: 'vertical', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!selectedOutcome}>Submit</Button>
      </div>
    </div>
  );
}
