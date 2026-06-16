import type { CarRequest } from '@/types/request';
import styles from './progress-bar.module.css';

export type StageState = 'empty' | 'started' | 'completed';

interface StageDef {
  slug: string;
  label: string;
  isSkipped: (req: CarRequest) => boolean;
  isComplete: (req: CarRequest) => boolean;
  isStarted: (req: CarRequest) => boolean;
}

const STAGES: StageDef[] = [
  { slug: 'storage', label: 'Storage', isSkipped: () => false, isComplete: r => !!r.storageAt, isStarted: () => false },
  { slug: 'vehicle_received', label: 'Received', isSkipped: () => false, isComplete: r => !!r.vehicleReceivedAt, isStarted: () => false },
  { slug: 'mechanical_check', label: 'Mech Check', isSkipped: () => false, isComplete: r => !!r.mechanicalCheckCompletedAt, isStarted: r => !!r.mechanicalCheckStartedAt },
  { slug: 'pdi', label: 'PDI', isSkipped: r => r.requestType?.value === 'no_pdi', isComplete: r => !!r.pdiCompletedAt, isStarted: r => !!r.pdiStartedAt },
  { slug: 'sent_to_accessories', label: 'To Acc.', isSkipped: r => !r.hasAccessories && (!r.accessories || r.accessories.length === 0), isComplete: r => !!r.sentToAccessoriesAt, isStarted: () => false },
  { slug: 'accessories', label: 'Accessories', isSkipped: r => !r.hasAccessories && (!r.accessories || r.accessories.length === 0), isComplete: r => !!r.accessoriesCompletedAt, isStarted: r => !!r.accessoriesStartedAt },
  { slug: 'final_inspection', label: 'Final Insp.', isSkipped: () => false, isComplete: r => !!r.finalInspectionAt, isStarted: () => false },
  { slug: 'gps', label: 'GPS', isSkipped: r => !r.hasGps, isComplete: r => !!r.gpsConfirmedAt, isStarted: () => false },
  { slug: 'registration', label: 'Registration', isSkipped: () => false, isComplete: r => !!r.registeredAt, isStarted: () => false },
  { slug: 'delivery', label: 'Delivery', isSkipped: () => false, isComplete: r => !!r.deliveredAt, isStarted: () => false },
];

interface ProgressBarProps {
  request: CarRequest;
  variant?: 'default' | 'compact';
}

export function ProgressBar({
  request,
  variant = 'default',
}: ProgressBarProps) {
  const applicable = STAGES.filter(s => !s.isSkipped(request));
  const completedCount = applicable.filter(s => s.isComplete(request)).length;

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        {applicable.map((stage) => {
          const done = stage.isComplete(request);
          const started = stage.isStarted(request);
          const state: StageState = done ? 'completed' : started ? 'started' : 'empty';
          return (
            <div
              key={stage.slug}
              className={`${styles.compactDot} ${styles[state]}`}
              title={`${stage.label}: ${state === 'completed' ? 'Done' : state === 'started' ? 'In Progress' : 'Pending'}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.track}>
      <div className={styles.row}>
        {applicable.map((stage, idx) => {
          const done = stage.isComplete(request);
          const started = stage.isStarted(request);
          const state: StageState = done ? 'completed' : started ? 'started' : 'empty';

          const prevStage = idx > 0 ? applicable[idx - 1] : null;
          const prevDone = prevStage ? prevStage.isComplete(request) : null;

          let connectorClass = '';
          if (prevDone === true) connectorClass = styles.completed;
          else if (prevDone === false) {
            const prevStarted = prevStage!.isStarted(request);
            connectorClass = prevStarted ? styles.active : '';
          }

          return (
            <div key={stage.slug} className={styles.segment}>
              {idx > 0 && (
                <div
                  className={`${styles.connector} ${connectorClass}`}
                  aria-hidden="true"
                />
              )}
              <div
                className={`${styles.dot} ${styles[state]}`}
                title={stage.label}
              />
            </div>
          );
        })}
      </div>
      <span className={styles.label}>
        {completedCount}/{applicable.length} stages completed
      </span>
    </div>
  );
}

/**
 * Convenience hook for computing progress from a CarRequest.
 */
export function useProgressInfo(request: CarRequest) {
  const applicable = STAGES.filter(s => !s.isSkipped(request));
  const completed = applicable.filter(s => s.isComplete(request)).length;
  return { completed, total: applicable.length };
}
