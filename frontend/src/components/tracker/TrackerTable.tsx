import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Car, ChevronLeft, ChevronRight as ChevronRightIcon, Edit3 } from 'lucide-react';
import type { CarRequest } from '@/types/request';
import type { RequestFilters } from '@/hooks/useRequests';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequestDetailCard } from './RequestDetailCard';
import styles from './tracker.module.css';

// ── Props ──────────────────────────────────────────────────────

interface TrackerTableProps {
  requests: CarRequest[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  filters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  userRole: string;
  onEditRequest?: (request: CarRequest) => void;
  onStageAction?: (requestId: number, stage: string, action: string) => void;
  selectedIds: Set<number>;
  onSelectId: (id: number) => void;
  onSelectAll: () => void;
}

// ── Helpers ────────────────────────────────────────────────────

/** Format an ISO string as "DD MMM YYYY HH:MM" (e.g. "15 Jun 2026 14:30"). */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}

/** Format duration in minutes to a human-readable string. */
function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Ordered stage slugs matching the pipeline progression. */
const STAGE_SLUGS = [
  'storage',
  'vehicle_received',
  'mechanical_check',
  'pdi',
  'sent_to_accessories',
  'accessories',
  'final_inspection',
  'gps',
  'registration',
  'delivery',
] as const;

type StageSlug = (typeof STAGE_SLUGS)[number];

/** Whether a stage is skipped (not applicable) for this request. */
function isStageSkipped(req: CarRequest, stage: StageSlug): boolean {
  switch (stage) {
    case 'pdi':
      return req.requestType?.value === 'no_pdi';
    case 'sent_to_accessories':
    case 'accessories':
      return !req.hasAccessories && (!req.accessories || req.accessories.length === 0);
    case 'gps':
      return !req.hasGps;
    default:
      return false;
  }
}

/** Whether a stage is completed (or skipped, which counts as effectively complete). */
function isStageComplete(req: CarRequest, stage: StageSlug): boolean {
  if (isStageSkipped(req, stage)) return true;
  switch (stage) {
    case 'storage':
      return !!req.storageAt;
    case 'vehicle_received':
      return !!req.vehicleReceivedAt;
    case 'mechanical_check':
      return !!req.mechanicalCheckCompletedAt;
    case 'pdi':
      return !!req.pdiCompletedAt;
    case 'sent_to_accessories':
      return !!req.sentToAccessoriesAt;
    case 'accessories':
      return !!req.accessoriesCompletedAt;
    case 'final_inspection':
      return !!req.finalInspectionAt;
    case 'gps':
      return !!req.gpsConfirmedAt;
    case 'registration':
      return !!req.registeredAt;
    case 'delivery':
      return !!req.deliveredAt;
    default:
      return false;
  }
}

/** Returns the first incomplete, non-skipped stage — the request's current position. */
function getCurrentStage(req: CarRequest): StageSlug | null {
  for (const stage of STAGE_SLUGS) {
    if (!isStageComplete(req, stage)) return stage;
  }
  return null;
}

/** Can the given userRole perform actions on this stage for this request? */
function canActOnStage(req: CarRequest, stage: StageSlug, userRole: string): boolean {
  if (req.status !== 'active') return false;
  const currentStage = getCurrentStage(req);
  if (currentStage !== stage) return false;

  const roleMap: Record<StageSlug, string> = {
    storage: 'nvs',
    vehicle_received: 'qc_nvs',
    mechanical_check: 'mechanical_check',
    pdi: 'pdi',
    sent_to_accessories: 'qc_nvs',
    accessories: 'accessories',
    final_inspection: 'qc_nvs',
    gps: 'mechanical_check',
    registration: 'registration',
    delivery: 'delivery',
  };

  if (userRole === 'super_admin') return true;
  return userRole === roleMap[stage];
}

/** Build a concatenated brand/model/variant string, e.g. "BYD SEAL SEAL-FLAG". */
function buildBrandModel(req: CarRequest): string {
  const parts = [req.brand?.label, req.model?.label, req.variant?.label].filter(Boolean);
  return parts.join(' ') || '—';
}

// ── Cell renderers ─────────────────────────────────────────────

/** Render a stage cell that has a start/complete lifecycle (Mechanical, PDI, Accessories). */
function renderStartCompleteStage(
  req: CarRequest,
  stage: StageSlug,
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  duration: number | null | undefined,
  startLabel: string,
  completeLabel: string,
  canAct: boolean,
  onAction: (action: string) => void,
) {
  if (isStageSkipped(req, stage)) {
    return <span className={styles.stageEmpty}>N/A</span>;
  }

  if (completedAt) {
    return (
      <div className={styles.stageTimestamp}>
        {startedAt && (
          <div className={styles.stageStarted}>
            <span className="label">Start:</span>{' '}
            <span className="time">{formatDate(startedAt)}</span>
          </div>
        )}
        <div className={styles.stageCompleted}>
          <span className="label">Complete:</span>{' '}
          <span className="time">{formatDate(completedAt)}</span>
        </div>
        {duration != null && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Duration: {formatDuration(duration)}
          </div>
        )}
      </div>
    );
  }

  if (startedAt) {
    return (
      <div>
        <div className={styles.stageTimestamp}>
          <div className={styles.stageStarted}>
            <span className="label">Start:</span>{' '}
            <span className="time">{formatDate(startedAt)}</span>
          </div>
        </div>
        {canAct && (
          <div className={styles.stageAction} onClick={(e) => e.stopPropagation()}>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnComplete}`}
              onClick={() => onAction('complete')}
            >
              {completeLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (canAct) {
    return (
      <div className={styles.stageAction} onClick={(e) => e.stopPropagation()}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnStart}`}
          onClick={() => onAction('start')}
        >
          {startLabel}
        </button>
      </div>
    );
  }

  return <span className={styles.stageEmpty}>—</span>;
}

/** Render a stage cell that has a single timestamp + optional action button. */
function renderSingleActionStage(
  req: CarRequest,
  stage: StageSlug,
  timestamp: string | null | undefined,
  buttonLabel: string,
  canAct: boolean,
  onAction: () => void,
  extra?: React.ReactNode,
) {
  if (isStageSkipped(req, stage)) {
    return <span className={styles.stageEmpty}>N/A</span>;
  }

  if (timestamp) {
    return (
      <div className={styles.stageTimestamp}>
        <div className={styles.stageCompleted}>
          <span className="time">{formatDate(timestamp)}</span>
        </div>
        {extra}
      </div>
    );
  }

  if (canAct) {
    return (
      <div className={styles.stageAction} onClick={(e) => e.stopPropagation()}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnStart}`}
          onClick={onAction}
        >
          {buttonLabel}
        </button>
      </div>
    );
  }

  return <span className={styles.stageEmpty}>—</span>;
}

// ── Main Component ─────────────────────────────────────────────

export function TrackerTable({
  requests,
  isLoading,
  total,
  page,
  limit,
  filters,
  onFiltersChange,
  userRole,
  onEditRequest,
  onStageAction,
  selectedIds,
  onSelectId,
  onSelectAll,
}: TrackerTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  const allSelected = requests.length > 0 && requests.every((r) => selectedIds.has(r.id));

  const canSelect = userRole !== 'viewer';

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        onFiltersChange({ ...filters, page: newPage });
      }
    },
    [filters, onFiltersChange, totalPages],
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      onFiltersChange({ ...filters, limit: newLimit, page: 1 });
    },
    [filters, onFiltersChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand(id);
      }
    },
    [toggleExpand],
  );

  const handleStageAction = useCallback((reqId: number, stage: string, action: string) => {
    onStageAction?.(reqId, stage, action);
  }, [onStageAction]);

  const dataColSpan = (canSelect ? 1 : 0) + 1 + 17; // checkbox + expand + 17 columns

  // ── Skeleton loading ────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────

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

              <th style={{ width: 180 }}>Request</th>
              <th style={{ width: 150 }}>Date</th>
              <th style={{ width: 150 }}>Customer</th>
              <th style={{ width: 180 }}>Brand/Model</th>
              <th style={{ width: 120 }}>Request Type</th>
              <th style={{ width: 150 }}>Promise Date</th>
              <th style={{ width: 160 }}>Storage</th>
              <th style={{ width: 160 }}>Vehicle Received</th>
              <th style={{ width: 180 }}>Mechanical Check</th>
              <th style={{ width: 180 }}>PDI</th>
              <th style={{ width: 200 }}>Sent to Accessories</th>
              <th style={{ width: 180 }}>Accessories</th>
              <th style={{ width: 180 }}>Final Inspection</th>
              <th style={{ width: 140 }}>GPS</th>
              <th style={{ width: 140 }}>Registration</th>
              <th style={{ width: 160 }}>Delivery</th>
              <th style={{ width: 120 }}>Status</th>
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
              requests.map((req) => {
                const canActStorage = canActOnStage(req, 'storage', userRole);
                const canActVehicleReceived = canActOnStage(req, 'vehicle_received', userRole);
                const canActMechanical = canActOnStage(req, 'mechanical_check', userRole);
                const canActPdi = canActOnStage(req, 'pdi', userRole);
                const canActSentToAcc = canActOnStage(req, 'sent_to_accessories', userRole);
                const canActAccessories = canActOnStage(req, 'accessories', userRole);
                const canActFinalInspection = canActOnStage(req, 'final_inspection', userRole);
                const canActGps = canActOnStage(req, 'gps', userRole);
                const canActRegistration = canActOnStage(req, 'registration', userRole);
                const canActDelivery = canActOnStage(req, 'delivery', userRole);

                return (
                  <>
                  <tr
                    key={req.id}
                    className={selectedIds.has(req.id) ? styles.selected : undefined}
                  >
                    {/* Checkbox (admin/super_admin only) */}
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
                    {/* Expand + Edit */}
                    <td className={styles.expandCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <button
                          className={styles.expandButton}
                          onClick={() => toggleExpand(req.id)}
                          onKeyDown={(e) => handleKeyDown(e, req.id)}
                          aria-expanded={expandedId === req.id}
                          aria-label={expandedId === req.id ? 'Collapse row' : 'Expand row'}
                        >
                          {expandedId === req.id ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                        {onEditRequest &&
                          (userRole === 'super_admin' ||
                           (userRole === 'admin' && req.status === 'active')) && (
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

                    {/* 1. Request */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span className={styles.requestNumber}>{req.requestNumber}</span>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {req.chassisNumber}
                      </div>
                    </td>

                    {/* 2. Date */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                        {formatDate(req.createdAt)}
                      </span>
                    </td>

                    {/* 3. Customer */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span className={styles.clientName}>{req.customerName}</span>
                    </td>

                    {/* 4. Brand/Model */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span
                        style={{
                          fontSize: 'var(--text-sm)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {buildBrandModel(req)}
                      </span>
                    </td>

                    {/* 5. Request Type */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                        {req.requestType?.label || '—'}
                      </span>
                    </td>

                    {/* 6. Promise Date */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <span style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                        {formatDate(req.promiseDate) || '—'}
                      </span>
                    </td>

                    {/* 7. Storage */}
                    <td className={styles.stageCell}>
                      {renderSingleActionStage(
                        req,
                        'storage',
                        req.storageAt,
                        'Dispatch Vehicle',
                        canActStorage,
                        () => handleStageAction(req.id, 'storage', 'dispatch'),
                      )}
                    </td>

                    {/* 8. Vehicle Received */}
                    <td className={styles.stageCell}>
                      {renderSingleActionStage(
                        req,
                        'vehicle_received',
                        req.vehicleReceivedAt,
                        'Vehicle Received',
                        canActVehicleReceived,
                        () => handleStageAction(req.id, 'vehicle_received', 'receive'),
                      )}
                    </td>

                    {/* 9. Mechanical Check */}
                    <td className={styles.stageCell}>
                      {renderStartCompleteStage(
                        req,
                        'mechanical_check',
                        req.mechanicalCheckStartedAt,
                        req.mechanicalCheckCompletedAt,
                        req.mechanicalCheckDuration,
                        'Start',
                        'Complete',
                        canActMechanical,
                        (action) => handleStageAction(req.id, 'mechanical_check', action),
                      )}
                    </td>

                    {/* 10. PDI (conditional) */}
                    <td className={styles.stageCell}>
                      {renderStartCompleteStage(
                        req,
                        'pdi',
                        req.pdiStartedAt,
                        req.pdiCompletedAt,
                        req.pdiDuration,
                        'Start PDI',
                        'Complete PDI',
                        canActPdi,
                        (action) => handleStageAction(req.id, 'pdi', action),
                      )}
                    </td>

                    {/* 11. Sent to Accessories (conditional) */}
                    <td className={styles.stageCell}>
                      {renderSingleActionStage(
                        req,
                        'sent_to_accessories',
                        req.sentToAccessoriesAt,
                        'Confirm Sent to Accessories',
                        canActSentToAcc,
                        () => handleStageAction(req.id, 'sent_to_accessories', 'confirm'),
                      )}
                    </td>

                    {/* 12. Accessories (conditional) */}
                    <td className={styles.stageCell}>
                      {renderStartCompleteStage(
                        req,
                        'accessories',
                        req.accessoriesStartedAt,
                        req.accessoriesCompletedAt,
                        req.accessoriesDuration,
                        'Start',
                        'Complete',
                        canActAccessories,
                        (action) => handleStageAction(req.id, 'accessories', action),
                      )}
                    </td>

                    {/* 13. Final Inspection */}
                    <td className={styles.stageCell}>
                      {(() => {
                        if (isStageSkipped(req, 'final_inspection')) {
                          return <span className={styles.stageEmpty}>N/A</span>;
                        }
                        if (req.finalInspectionAt) {
                          return (
                            <div className={styles.stageTimestamp}>
                              <div className={styles.stageCompleted}>
                                <span className="time">{formatDate(req.finalInspectionAt)}</span>
                              </div>
                              {req.finalInspectionOutcome && (
                                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                                  {req.finalInspectionOutcome}
                                </div>
                              )}
                              {req.finalInspectionRemarks && (
                                <div
                                  style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--color-text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {req.finalInspectionRemarks}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (canActFinalInspection) {
                          return (
                            <div
                              className={styles.stageAction}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnStart}`}
                                onClick={() =>
                                  handleStageAction(req.id, 'final_inspection', 'open_modal')
                                }
                              >
                                Final Inspection
                              </button>
                            </div>
                          );
                        }
                        return <span className={styles.stageEmpty}>—</span>;
                      })()}
                    </td>

                    {/* 14. GPS (conditional) */}
                    <td className={styles.stageCell}>
                      {renderSingleActionStage(
                        req,
                        'gps',
                        req.gpsConfirmedAt,
                        'Confirm GPS Done',
                        canActGps,
                        () => handleStageAction(req.id, 'gps', 'confirm'),
                      )}
                    </td>

                    {/* 15. Registration */}
                    <td className={styles.stageCell}>
                      {renderSingleActionStage(
                        req,
                        'registration',
                        req.registeredAt,
                        'Register',
                        canActRegistration,
                        () => handleStageAction(req.id, 'registration', 'register'),
                      )}
                    </td>

                    {/* 16. Delivery */}
                    <td className={styles.stageCell}>
                      {(() => {
                        if (isStageSkipped(req, 'delivery')) {
                          return <span className={styles.stageEmpty}>N/A</span>;
                        }
                        if (req.deliveredAt) {
                          return (
                            <div className={styles.stageTimestamp}>
                              <div className={styles.stageCompleted}>
                                <span className="time">{formatDate(req.deliveredAt)}</span>
                              </div>
                              {req.deliveryRemarks && (
                                <div
                                  style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--color-text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {req.deliveryRemarks}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (canActDelivery) {
                          return (
                            <div
                              className={styles.stageAction}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnStart}`}
                                onClick={() =>
                                  handleStageAction(req.id, 'delivery', 'confirm')
                                }
                              >
                                Confirm Delivery
                              </button>
                            </div>
                          );
                        }
                        return <span className={styles.stageEmpty}>—</span>;
                      })()}
                    </td>

                    {/* 17. Status */}
                    <td onClick={() => toggleExpand(req.id)} className={styles.clickable}>
                      <Badge
                        variant={req.isDelayed ? 'delayed' : 'onTime'}
                        label={req.isDelayed ? 'Delayed' : 'On Time'}
                      />
                    </td>
                  </tr>
                  {expandedId === req.id && (
                    <tr className={styles.detailRow}>
                      <td colSpan={dataColSpan}>
                        <div className={styles.detailCell}>
                          <RequestDetailCard
                            request={req}
                            onEditRequest={onEditRequest}
                            userRole={userRole}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
