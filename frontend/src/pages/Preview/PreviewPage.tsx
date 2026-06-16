import { useState, useCallback, useMemo, useEffect } from 'react';
import { RefreshCw, AlertCircle, Search, LayoutGrid, Table2 } from 'lucide-react';
import { useRequests } from '@/hooks/useRequests';
import { useDepartments } from '@/hooks/useDepartments';
import type { RequestFilters } from '@/hooks/useRequests';
import { Skeleton } from '@/components/ui/Skeleton';
import { PreviewFilters } from '@/components/preview/PreviewFilters';
import { CardView } from '@/components/preview/CardView';
import { TableView } from '@/components/preview/TableView';
import type { PreviewFiltersState } from '@/components/preview/PreviewFilters';
import styles from './preview.module.css';

type ViewMode = 'cards' | 'table';

const VIEW_STORAGE_KEY = 'byd-otd-preview-view';
const DEFAULT_VIEW: ViewMode = 'table';
const MAX_LIMIT = 100;

function getDateRangeFilter(
  dateRange: string,
): { dateFrom?: string; dateTo?: string } {
  if (!dateRange) return {};

  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { dateFrom: start.toISOString() };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - diff,
      );
      return { dateFrom: monday.toISOString() };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: first.toISOString() };
    }
    default:
      return {};
  }
}

/** Read persisted view mode, falling back to the default. */
function readStoredView(): ViewMode {
  try {
    const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'cards' || stored === 'table') return stored;
    return DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Skeleton variant="title" width="55%" />
        <Skeleton variant="text" width="60px" />
      </div>
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="60%" />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: 'rgba(107, 122, 153, 0.1)',
            }}
          />
        ))}
      </div>
      <Skeleton variant="text" width="50%" />
    </div>
  );
}

export default function PreviewPage() {
  const [filters, setFilters] = useState<PreviewFiltersState>({
    status: '',
    departmentId: '',
    dateRange: '',
  });
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Persist view mode choice across navigations within the session
  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* noop */
    }
  }, [viewMode]);

  // Build request filters from UI state
  const requestFilters: RequestFilters = useMemo(() => {
    const dateFilter = getDateRangeFilter(filters.dateRange);
    return {
      status: (filters.status as RequestFilters['status']) || undefined,
      departmentId: filters.departmentId
        ? Number(filters.departmentId)
        : undefined,
      search: search || undefined,
      ...dateFilter,
      limit: MAX_LIMIT,
    };
  }, [filters.status, filters.departmentId, filters.dateRange, search]);

  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useRequests(requestFilters, {
    refetchInterval: 60_000,
  });

  const {
    data: departments = [],
    isLoading: isDepartmentsLoading,
    error: departmentsError,
  } = useDepartments();

  const requests = useMemo(() => requestsData?.items ?? [], [requestsData]);

  const isLoading = isRequestsLoading || isDepartmentsLoading;
  const queryError = requestsError || departmentsError;

  const handleFiltersChange = useCallback(
    (newFilters: PreviewFiltersState) => {
      setFilters(newFilters);
    },
    [],
  );

  const handleToggleCompleted = useCallback(() => {
    setCompletedExpanded((prev) => !prev);
  }, []);

  const hasRequests = requests.length > 0;
  const showData = !isLoading && hasRequests;

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────── */}
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Preview Board</h1>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <Table2 size={16} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'cards' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <div className={styles.refreshIndicator}>
            <RefreshCw size={12} />
            <span>Auto-refreshes every 60s</span>
          </div>
        </div>
      </div>

      {/* ── Error Banner ────────────────────── */}
      {queryError && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>
            Failed to load data:{' '}
            {queryError instanceof Error
              ? queryError.message
              : 'Unknown error'}
          </span>
          <button
            className={styles.retryBtn}
            onClick={() => refetchRequests()}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* ── Filters ─────────────────────────── */}
      <div className={styles.filterBar}>
        <PreviewFilters
          filters={filters}
          departments={departments}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      {/* ── Loading State ───────────────────── */}
      {isLoading && !hasRequests && (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Table View (default) ────────────── */}
      {viewMode === 'table' && showData && (
        <TableView requests={requests} departments={departments} />
      )}

      {/* ── Card View ───────────────────────── */}
      {viewMode === 'cards' && showData && (
        <CardView
          requests={requests}
          departments={departments}
          completedExpanded={completedExpanded}
          onToggleCompleted={handleToggleCompleted}
        />
      )}

      {/* ── Empty State (after loading, no data) ── */}
      {!isLoading && !hasRequests && !queryError && (
        <CardView
          requests={[]}
          departments={departments}
          completedExpanded={completedExpanded}
          onToggleCompleted={handleToggleCompleted}
        />
      )}
    </div>
  );
}
