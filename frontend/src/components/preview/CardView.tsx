import type { CarRequest, Department, RequestStatus } from '@/types/request';
import { RequestProgressCard } from '@/components/preview/RequestProgressCard';
import { ClipboardList } from 'lucide-react';
import styles from '@/pages/Preview/preview.module.css';

export const STATUS_PRIORITY: RequestStatus[] = [
  'active',
  'archived_manual',
  'archived_qc',
  'cancelled',
];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  archived_manual: 'Archived',
  archived_qc: 'Archived (QC)',
};

interface CardViewProps {
  requests: CarRequest[];
  departments: Department[];
  completedExpanded: boolean;
  onToggleCompleted: () => void;
}

/** Group requests by status priority and render a section per group. */
function groupByStatus(requests: CarRequest[]): Map<RequestStatus, CarRequest[]> {
  const groups: Map<RequestStatus, CarRequest[]> = new Map();
  for (const status of STATUS_PRIORITY) {
    groups.set(status, []);
  }
  for (const req of requests) {
    const group = groups.get(req.status);
    if (group) group.push(req);
  }
  return groups;
}

export function CardView({
  requests,
  departments,
  completedExpanded,
  onToggleCompleted,
}: CardViewProps) {
  if (requests.length === 0) {
    return (
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
    );
  }

  const grouped = groupByStatus(requests);

  return (
    <>
      {STATUS_PRIORITY.map((status) => {
        const items = grouped.get(status) ?? [];
        if (items.length === 0) return null;

        const isActiveSection = status === 'active';
        const showAll = isActiveSection ? completedExpanded : true;
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

              {isActiveSection && (
                <button
                  onClick={onToggleCompleted}
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
                    onClick={onToggleCompleted}
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
                    Show {items.length - 3} more
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
