import type { CarRequest, Department, RequestStageTransition } from '@/types/request';
import { ProgressBar, getStageState } from '@/components/preview/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import styles from './table-view.module.css';

interface TableViewProps {
  requests: CarRequest[];
  departments: Department[];
}

function getCurrentStageName(
  transitions: RequestStageTransition[],
  departments: Department[],
): string {
  // Find the latest "started" without a matching "completed" after it
  const startedWithoutCompleted = transitions
    .filter((t) => t.action === 'started')
    .filter((started) => {
      return !transitions.some(
        (t) =>
          t.action === 'completed' &&
          t.departmentId === started.departmentId &&
          new Date(t.actionedAt) > new Date(started.actionedAt),
      );
    })
    .sort(
      (a, b) =>
        new Date(b.actionedAt).getTime() - new Date(a.actionedAt).getTime(),
    );

  if (startedWithoutCompleted.length === 0) {
    // Check if ALL departments are completed → fully done
    const sortedDepts = [...departments].sort(
      (a, b) => a.pipelineOrder - b.pipelineOrder,
    );
    const allDone = sortedDepts.every(
      (d) => getStageState(transitions, d.id) === 'completed',
    );
    if (allDone) return 'Completed';
    return 'Not started';
  }

  const latest = startedWithoutCompleted[0];
  const dept = departments.find((d) => d.id === latest.departmentId);
  return dept?.name ?? `Dept #${latest.departmentId}`;
}

/**
 * Simple delay heuristic: if status is archived/cancelled or the request is
 * active and older than 7 days. Uses the new pipeline status model.
 */
function isDelayed(req: CarRequest): boolean {
  if (req.status === 'archived_manual' || req.status === 'archived_qc') return true;
  if (req.status === 'cancelled') return true;

  if (!req.storageAt) {
    const ageMs = Date.now() - new Date(req.createdAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return ageMs > sevenDaysMs;
  }

  return false;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TableView({ requests, departments }: TableViewProps) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Request #</th>
            <th>Chassis #</th>
            <th>Brand / Model</th>
            <th>Variant</th>
            <th>Client</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Created</th>
            <th>On Time</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => {
            const delayed = isDelayed(req);
            const stageName = getCurrentStageName(req.transitions, departments);

            return (
              <tr key={req.id} className={styles.row}>
                {/* Request # */}
                <td className={styles.mono}>{req.requestNumber}</td>

                {/* Chassis # */}
                <td>{req.chassisNumber}</td>

                {/* Brand / Model */}
                <td>{req.brand?.label ?? '--'} / {req.model?.label ?? '--'}</td>

                {/* Variant */}
                <td>{req.variant?.label ?? '--'}</td>

                {/* Client */}
                <td className={styles.clientCell}>
                  <span className={styles.clientName}>{req.customerName}</span>
                  {req.customerPhone && (
                    <span className={styles.clientTel}>{req.customerPhone}</span>
                  )}
                </td>

                {/* Current Stage */}
                <td>
                  <span className={styles.stageLabel}>{stageName}</span>
                </td>

                {/* Status */}
                <td>
                  <Badge
                    variant={req.status}
                    label={req.status.replace('_', ' ')}
                  />
                </td>

                {/* Created date */}
                <td className={styles.dateCell}>{formatDate(req.createdAt)}</td>

                {/* On Time / Delay */}
                <td>
                  {delayed ? (
                    <span className={styles.delayedBadge}>Delayed</span>
                  ) : (
                    <span className={styles.onTimeBadge}>On Time</span>
                  )}
                </td>

                {/* Progress (compact) */}
                <td>
                  <ProgressBar
                    transitions={req.transitions}
                    departments={departments}
                    variant="compact"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
