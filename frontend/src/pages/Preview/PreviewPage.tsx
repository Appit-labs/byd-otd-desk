import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, ClipboardList, AlertCircle } from 'lucide-react';
import { useRequests } from '@/hooks/useRequests';
import { useDepartments } from '@/hooks/useDepartments';
import type { RequestFilters } from '@/hooks/useRequests';
import type { CarRequest, RequestStatus } from '@/types/request';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequestProgressCard } from '@/components/preview/RequestProgressCard';
import { PreviewFilters } from '@/components/preview/PreviewFilters';
import type { PreviewFiltersState } from '@/components/preview/PreviewFilters';
import styles from './preview.module.css';

const STATUS_PRIORITY: RequestStatus[] = [
  'pending',
  'not_started',
  'on_hold',
  'completed',
];

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Active',
  not_started: 'Not Started',
  on_hold: 'On Hold',
  completed: 'Completed',
};

const MAX_LIMIT = 100;

function getDateRangeFilter(
  dateRange: string,
): { dateFrom?: string; dateTo?: string } {
  if (!dateRange) return {};

  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
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

  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Build request filters from UI state
  const requestFilters: RequestFilters = useMemo(() => {
    const dateFilter = getDateRangeFilter(filters.dateRange);
    return {
      status: (filters.status as RequestFilters['status']) || undefined,
      departmentId: filters.departmentId
        ? Number(filters.departmentId)
        : undefined,
      ...dateFilter,
      limit: MAX_LIMIT,
    };
  }, [filters.status, filters.departmentId, filters.dateRange]);

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

  // Group requests by status priority order
  const groupedRequests = useMemo(() => {
    const groups: Map<RequestStatus, CarRequest[]> = new Map();
    for (const status of STATUS_PRIORITY) {
      groups.set(status, []);
    }
    for (const req of requests) {
      const group = groups.get(req.status);
      if (group) {
        group.push(req);
      }
    }
    return groups;
  }, [requests]);

  const handleFiltersChange = useCallback(
    (newFilters: PreviewFiltersState) => {
      setFilters(newFilters);
    },
    [],
  );

  const hasRequests = requests.length > 0;

  return (
    <div className={styles.page}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 className={styles.pageTitle}>Preview Board</h1>
        <div className={styles.refreshIndicator}>
          <RefreshCw size={12} />
          <span>Auto-refreshes every 60s</span>
        </div>
      </div>

      {/* Error Banner */}
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

      {/* Filters */}
      <div className={styles.filterBar}>
        <PreviewFilters
          filters={filters}
          departments={departments}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      {/* Loading State */}
      {isLoading && !hasRequests && (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasRequests && !queryError && (
        <div className={styles.cardGrid}>
          <div className={styles.emptyState}>
            <ClipboardList size={48} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No requests found</p>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              Try adjusting your filters or check back later.
            </p>
          </div>
        </div>
      )}

      {/* Card Grid */}
      {hasRequests &&
        STATUS_PRIORITY.map((status) => {
          const items = groupedRequests.get(status) ?? [];
          if (items.length === 0) return null;

          const isCompletedSection = status === 'completed';
          const showAll = isCompletedSection ? completedExpanded : true;
          const displayItems = showAll ? items : items.slice(0, 3);
          const hasMore = items.length > 3;

          return (
            <div key={status} style={{ gridColumn: '1 / -1' }}>
              {/* Section header */}
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {STATUS_LABELS[status]}
                </h2>
                <span className={styles.sectionCount}>{items.length}</span>

                {/* Toggle for completed section */}
                {isCompletedSection && (
                  <button
                    onClick={() => setCompletedExpanded((prev) => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-1)',
                      padding: 'var(--spacing-1) var(--spacing-3)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: 'transparent',
                      marginLeft: 'var(--spacing-2)',
                      transition: 'color var(--transition-fast)',
                    }}
                    aria-expanded={completedExpanded}
                  >
                    {completedExpanded ? 'Collapse' : `Show ${items.length}`}
                  </button>
                )}
              </div>

              {/* Cards grid within section */}
              <div className={styles.cardGrid}>
                {displayItems.map((req) => (
                  <RequestProgressCard
                    key={req.id}
                    request={req}
                    departments={departments}
                  />
                ))}
                {/* Show "more items" indicator */}
                {!showAll && hasMore && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 'var(--spacing-4)',
                      gridColumn: '1 / -1',
                    }}
                  >
                    <button
                      onClick={() => setCompletedExpanded(true)}
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-accent)',
                        cursor: 'pointer',
                        background: 'none',
                        border: '1px solid rgba(0, 194, 255, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-2) var(--spacing-4)',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      Show {items.length - 3} more completed
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
