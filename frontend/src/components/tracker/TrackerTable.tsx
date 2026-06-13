import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Car, ChevronLeft, ChevronRight as ChevronRightIcon, Edit3 } from 'lucide-react';
import type { CarRequest, Department } from '@/types/request';
import type { RequestFilters } from '@/hooks/useRequests';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { StageCell } from './StageCell';
import { ReadyCell } from './ReadyCell';
import { RequestDetailCard } from './RequestDetailCard';
import styles from './tracker.module.css';

interface TrackerTableProps {
  requests: CarRequest[];
  departments: Department[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  filters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  userRole: string;
  columnVisibility: Record<string, boolean>;
  selectedIds: Set<number>;
  onSelectId: (id: number) => void;
  onSelectAll: () => void;
  onEditRequest?: (request: CarRequest) => void;
}

function getStageState(
  transitions: CarRequest['transitions'],
  deptId: number
): 'empty' | 'started' | 'completed' {
  const deptTransitions = transitions.filter((t) => t.departmentId === deptId);
  if (deptTransitions.some((t) => t.action === 'completed')) return 'completed';
  if (deptTransitions.some((t) => t.action === 'started')) return 'started';
  return 'empty';
}

export function TrackerTable({
  requests,
  departments,
  isLoading,
  total,
  page,
  limit,
  filters,
  onFiltersChange,
  userRole,
  columnVisibility,
  selectedIds,
  onSelectId,
  onSelectAll,
  onEditRequest,
}: TrackerTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  const allSelected = requests.length > 0 && requests.every((r) => selectedIds.has(r.id));

  // Sort departments by pipelineOrder for progress bar and stage columns
  const stageColumns = useMemo(
    () => [...departments].sort((a, b) => a.pipelineOrder - b.pipelineOrder),
    [departments]
  );

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        onFiltersChange({ ...filters, page: newPage });
      }
    },
    [filters, onFiltersChange, totalPages]
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      onFiltersChange({ ...filters, limit: newLimit, page: 1 });
    },
    [filters, onFiltersChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand(id);
      }
    },
    [toggleExpand]
  );

  const canSelect = userRole === 'super_admin' || userRole === 'department_user';

  const visibleStageCols = useMemo(
    () => stageColumns.filter((d) => columnVisibility[d.slug] !== false),
    [stageColumns, columnVisibility]
  );

  // Interleave departments with "Ready for" columns
  type PipelineColumn =
    | { type: 'dept'; dept: Department }
    | { type: 'ready'; prevDept: Department; nextDept: Department; key: string };

  const pipelineColumns = useMemo((): PipelineColumn[] => {
    const cols: PipelineColumn[] = [];
    const visibleDepts = visibleStageCols;
    for (let i = 0; i < visibleDepts.length; i++) {
      cols.push({ type: 'dept', dept: visibleDepts[i] });
      if (i < visibleDepts.length - 1) {
        cols.push({
          type: 'ready',
          prevDept: visibleDepts[i],
          nextDept: visibleDepts[i + 1],
          key: `ready-${visibleDepts[i].id}-${visibleDepts[i + 1].id}`,
        });
      }
    }
    return cols;
  }, [visibleStageCols]);

  const expandedRequest = expandedId !== null
    ? requests.find((r) => r.id === expandedId)
    : null;

  const dataColSpan =
    (canSelect ? 1 : 0) +
    1 + // expand column
    (columnVisibility.requestNumber !== false ? 1 : 0) +
    (columnVisibility.carNumber !== false ? 1 : 0) +
    (columnVisibility.clientName !== false ? 1 : 0) +
    (columnVisibility.status !== false ? 1 : 0) +
    (columnVisibility.progress !== false ? 1 : 0) +
    pipelineColumns.length;

  if (isLoading && requests.length === 0) {
    return (
      <div className={styles.tableWrapper}>
        <div style={{ padding: 'var(--spacing-3)' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton variant="tableRow" width="100%" height="20px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {canSelect && (
                <th className={styles.colCheckbox} style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allSelected}
                    onChange={onSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              <th style={{ width: 44 }} aria-label="Expand row" />
              {columnVisibility.requestNumber !== false && (
                <th className={styles.colRequest}>Request #</th>
              )}
              {columnVisibility.carNumber !== false && (
                <th className={styles.colCarNumber}>Car #</th>
              )}
              {columnVisibility.clientName !== false && (
                <th className={styles.colClient}>Client</th>
              )}
              {columnVisibility.status !== false && (
                <th className={styles.colStatus}>Status</th>
              )}
              {columnVisibility.progress !== false && (
                <th className={styles.colProgress}>Progress</th>
              )}
              {pipelineColumns.map((col) => (
                <th key={col.type === 'dept' ? `dept-${col.dept.id}` : col.key} className={col.type === 'dept' ? styles.colStage : styles.colReady}>
                  {col.type === 'dept' ? col.dept.name : `Ready for ${col.nextDept.name}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={dataColSpan}>
                  <div className={styles.emptyState}>
                    <Car size={40} className={styles.emptyIcon} />
                    <p className={styles.emptyText}>No requests found</p>
                  </div>
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className={selectedIds.has(req.id) ? styles.selected : undefined}>
                  {canSelect && (
                    <td className={styles.colCheckbox} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedIds.has(req.id)}
                        onChange={() => onSelectId(req.id)}
                        aria-label={`Select ${req.requestNumber}`}
                      />
                    </td>
                  )}
                  <td className={styles.expandCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button
                        className={styles.expandButton}
                        onClick={() => toggleExpand(req.id)}
                        onKeyDown={(e) => handleKeyDown(e, req.id)}
                        aria-expanded={expandedId === req.id}
                        aria-label={
                          expandedId === req.id
                            ? 'Collapse row'
                            : 'Expand row'
                        }
                      >
                        {expandedId === req.id ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                      {onEditRequest && userRole === 'super_admin' && (
                        <button
                          className={styles.expandButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRequest(req);
                          }}
                          aria-label={`Edit ${req.requestNumber}`}
                          title="Edit request"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                  {columnVisibility.requestNumber !== false && (
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span className={styles.requestNumber}>{req.requestNumber}</span>
                    </td>
                  )}
                  {columnVisibility.carNumber !== false && (
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span className={styles.carNumber}>{req.carNumber}</span>
                    </td>
                  )}
                  {columnVisibility.clientName !== false && (
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span className={styles.clientName}>{req.clientName}</span>
                    </td>
                  )}
                  {columnVisibility.status !== false && (
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <Badge variant={req.status} label={req.status.replace('_', ' ')} />
                    </td>
                  )}
                  {columnVisibility.progress !== false && (
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <div className={styles.progressBar} aria-label={`Progress: stage transitions`}>
                        {stageColumns.map((dept) => {
                          const state = getStageState(req.transitions, dept.id);
                          return (
                            <div
                              key={dept.id}
                              className={`${styles.progressStep} ${
                                state === 'completed' ? styles.completed : ''
                              } ${state === 'started' ? styles.active : ''}`}
                            />
                          );
                        })}
                      </div>
                    </td>
                  )}
                  {pipelineColumns.map((col) =>
                    col.type === 'dept' ? (
                      <StageCell
                        key={`dept-${col.dept.id}`}
                        department={col.dept}
                        request={req}
                      />
                    ) : (
                      <ReadyCell
                        key={col.key}
                        request={req}
                        previousDept={col.prevDept}
                        nextDept={col.nextDept}
                      />
                    )
                  )}
                </tr>
              ))
            )}
            {/* Expanded detail row */}
            {expandedRequest && (
              <tr className={styles.detailRow}>
                <td colSpan={dataColSpan}>
                  <div className={styles.detailCell}>
                    <RequestDetailCard
                      request={expandedRequest}
                      onEditRequest={onEditRequest}
                      userRole={userRole}
                    />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination -- hidden when there are no results */}
      {total > 0 && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of{' '}
            {total} requests
          </div>
          <div className={styles.paginationControls}>
            <select
              className={styles.paginationSelect}
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              className={styles.paginationBtn}
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const startPage = Math.max(1, page - 2);
              const p = startPage + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  className={`${styles.paginationBtn} ${p === page ? styles.active : ''}`}
                  onClick={() => handlePageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              );
            })}

            <button
              className={styles.paginationBtn}
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
