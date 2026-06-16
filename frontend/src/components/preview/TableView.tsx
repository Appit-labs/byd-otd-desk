import type { CarRequest } from '@/types/request';
import { ProgressBar } from '@/components/preview/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import styles from './table-view.module.css';

interface TableViewProps {
  requests: CarRequest[];
}

function getCurrentStageName(req: CarRequest): string {
  if (req.status !== 'active') {
    if (req.status === 'archived_manual' || req.status === 'archived_qc') return 'Archived';
    if (req.status === 'cancelled') return 'Cancelled';
    return req.status;
  }
  const checks: { label: string; done: boolean; skipped: boolean }[] = [
    { label: 'Storage', done: !!req.storageAt, skipped: false },
    { label: 'Vehicle Received', done: !!req.vehicleReceivedAt, skipped: false },
    { label: 'Mech. Check', done: !!req.mechanicalCheckCompletedAt, skipped: false },
    { label: 'PDI', done: !!req.pdiCompletedAt, skipped: req.requestType?.value === 'no_pdi' },
    { label: 'Sent to Acc.', done: !!req.sentToAccessoriesAt, skipped: !req.hasAccessories && (!req.accessories || req.accessories.length === 0) },
    { label: 'Accessories', done: !!req.accessoriesCompletedAt, skipped: !req.hasAccessories && (!req.accessories || req.accessories.length === 0) },
    { label: 'Final Insp.', done: !!req.finalInspectionAt, skipped: false },
    { label: 'GPS', done: !!req.gpsConfirmedAt, skipped: !req.hasGps },
    { label: 'Registration', done: !!req.registeredAt, skipped: false },
    { label: 'Delivery', done: !!req.deliveredAt, skipped: false },
  ];
  for (const c of checks) {
    if (c.skipped) continue;
    if (!c.done) return c.label;
  }
  return 'Completed';
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

export function TableView({ requests }: TableViewProps) {
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
            const stageName = getCurrentStageName(req);

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
                    request={req}
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
