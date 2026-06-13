import type { CarRequest, Department } from '@/types/request';
import styles from './tracker.module.css';

interface ReadyCellProps {
  request: CarRequest;
  previousDept: Department;
  nextDept: Department;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${time} ${day}`;
}

export function ReadyCell({ request, previousDept, nextDept }: ReadyCellProps) {
  // Find if previous department is completed
  const prevComplete = request.transitions.find(
    (t) => t.departmentId === previousDept.id && t.action === 'completed'
  );

  // Find if next department has started
  const nextStarted = request.transitions.find(
    (t) => t.departmentId === nextDept.id && t.action === 'started'
  );

  if (!prevComplete) {
    return (
      <td className={styles.readyCell}>
        <span className={styles.readyEmpty}>--</span>
      </td>
    );
  }

  // If next department already started, show "Ready" as completed/passed
  if (nextStarted) {
    return (
      <td className={styles.readyCell}>
        <div className={`${styles.stageTimestamp} ${styles.stageCompleted}`}>
          <span className={styles.label}>Ready</span>
          <span className={styles.time}> at {formatTimestamp(prevComplete.actionedAt)}</span>
        </div>
      </td>
    );
  }

  // Previous completed, next not started — currently "Ready for" state
  return (
    <td className={styles.readyCell}>
      <div className={`${styles.stageTimestamp} ${styles.readyActive}`}>
        <span className={styles.label}>Ready</span>
        <span className={styles.time}> at {formatTimestamp(prevComplete.actionedAt)}</span>
      </div>
    </td>
  );
}
