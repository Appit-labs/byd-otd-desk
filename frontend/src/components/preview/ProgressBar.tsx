import type { CarRequest, Department, RequestStageTransition } from '@/types/request';
import styles from './progress-bar.module.css';

interface ProgressBarProps {
  transitions: RequestStageTransition[];
  departments: Department[];
  /** 'default' = dots + connectors (for cards), 'compact' = dots only (for table cells) */
  variant?: 'default' | 'compact';
}

export type StageState = 'empty' | 'started' | 'completed';

export function getStageState(
  transitions: RequestStageTransition[],
  deptId: number,
): StageState {
  const deptTransitions = transitions.filter((t) => t.departmentId === deptId);
  if (deptTransitions.some((t) => t.action === 'completed')) return 'completed';
  if (deptTransitions.some((t) => t.action === 'started')) return 'started';
  return 'empty';
}

/**
 * Shared progress bar / pipeline visualisation.
 *
 * - default: horizontal row of stage dots connected by lines. Each
 *   dot + connector is coloured based on the stage state.
 * - compact: small coloured dots only, suitable for tight table cells.
 */
export function ProgressBar({
  transitions,
  departments,
  variant = 'default',
}: ProgressBarProps) {
  const sorted = [...departments].sort(
    (a, b) => a.pipelineOrder - b.pipelineOrder,
  );

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        {sorted.map((dept) => {
          const state = getStageState(transitions, dept.id);
          return (
            <div
              key={dept.id}
              className={`${styles.compactDot} ${styles[state]}`}
              title={`${dept.name}: ${state === 'completed' ? 'Done' : state === 'started' ? 'In Progress' : 'Pending'}`}
            />
          );
        })}
      </div>
    );
  }

  /* ---- default: dots + connectors ---- */
  const completedCount = sorted.filter(
    (d) => getStageState(transitions, d.id) === 'completed',
  ).length;

  return (
    <div className={styles.track}>
      <div className={styles.row}>
        {sorted.map((dept, idx) => {
          const state = getStageState(transitions, dept.id);

          // Connector colour is driven by the *preceding* dot's state
          const prevState =
            idx > 0 ? getStageState(transitions, sorted[idx - 1].id) : null;

          let connectorClass = '';
          if (prevState === 'completed') connectorClass = styles.completed;
          else if (prevState === 'started') connectorClass = styles.active;

          return (
            <div key={dept.id} className={styles.segment}>
              {/* Connector line before the dot (hidden for first) */}
              {idx > 0 && (
                <div
                  className={`${styles.connector} ${connectorClass}`}
                  aria-hidden="true"
                />
              )}
              <div
                className={`${styles.dot} ${styles[state]}`}
                title={dept.name}
              />
            </div>
          );
        })}
      </div>
      <span className={styles.label}>
        {completedCount}/{sorted.length} stages completed
      </span>
    </div>
  );
}

/**
 * Convenience hook for computing stage state from a CarRequest.
 */
export function useProgressInfo(
  request: CarRequest,
  departments: Department[],
) {
  const sorted = [...departments].sort(
    (a, b) => a.pipelineOrder - b.pipelineOrder,
  );
  const completed = sorted.filter(
    (d) => getStageState(request.transitions, d.id) === 'completed',
  ).length;
  return { completed, total: sorted.length };
}
