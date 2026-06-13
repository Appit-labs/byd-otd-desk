import type { CarRequest, Department } from '@/types/request';
import styles from './tracker.module.css';

interface StageCellProps {
  department: Department;
  request: CarRequest;
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

export function StageCell({ department, request }: StageCellProps) {
  const deptTransitions = request.transitions.filter(
    (t) => t.departmentId === department.id
  );

  const startTransition = deptTransitions.find((t) => t.action === 'started');
  const completeTransition = deptTransitions.find((t) => t.action === 'completed');

  if (!startTransition && !completeTransition) {
    return (
      <td className={styles.stageCell}>
        <span className={styles.stageEmpty}>--</span>
      </td>
    );
  }

  if (startTransition && !completeTransition) {
    return (
      <td className={styles.stageCell}>
        <div className={`${styles.stageTimestamp} ${styles.stageStarted}`}>
          <span className={styles.label}>Started</span>
          <span className={styles.time}> at {formatTimestamp(startTransition.actionedAt)}</span>
        </div>
      </td>
    );
  }

  return (
    <td className={styles.stageCell}>
      <div className={`${styles.stageTimestamp} ${styles.stageCompleted}`}>
        <span className={styles.label}>Done</span>
        <span className={styles.time}> at {formatTimestamp(completeTransition!.actionedAt)}</span>
      </div>
    </td>
  );
}
