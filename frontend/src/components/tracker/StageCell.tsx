import type { CarRequest, Department } from '@/types/request';
import { StageActionButton } from './StageActionButton';
import styles from './tracker.module.css';

interface StageCellProps {
  department: Department;
  request: CarRequest;
  userDepartmentId: number | undefined;
  userRole: string;
  onTransition: (requestId: number, departmentId: number, action: 'started' | 'completed') => void;
  loadingRequestId: number | null;
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

export function StageCell({
  department,
  request,
  userDepartmentId,
  userRole,
  onTransition,
  loadingRequestId,
}: StageCellProps) {
  const sortedTransitions = [...request.transitions].sort(
    (a, b) => new Date(a.actionedAt).getTime() - new Date(b.actionedAt).getTime()
  );

  const departmentTransitions = sortedTransitions.filter(
    (t) => t.departmentId === department.id
  );

  const startTransition = departmentTransitions.find((t) => t.action === 'started');
  const completeTransition = departmentTransitions.find((t) => t.action === 'completed');

  const isStarted = !!startTransition;
  const isCompleted = !!completeTransition;

  // Role-aware action button visibility:
  // - super_admin: sees buttons in ALL columns
  // - department_user: sees buttons ONLY in their own department column
  // - admin: sees NO action buttons (view-only, excluded here intentionally)
  // - viewer: handled by parent (TrackerPage redirects before this renders)
  const canUserActOnStage =
    userRole === 'super_admin' ||
    (userRole === 'department_user' && userDepartmentId === department.id);

  const previousDepartmentTransitions = sortedTransitions.filter(
    (t) => t.department.pipelineOrder < department.pipelineOrder
  );
  const previousCompleted = previousDepartmentTransitions.some((t) => t.action === 'completed');
  const isFirst = previousDepartmentTransitions.length === 0;
  const canAct = (isFirst || previousCompleted) && request.status !== 'on_hold' && !isCompleted;

  if (!isStarted && !isCompleted) {
    return (
      <td className={styles.stageCell}>
        <span className={styles.stageEmpty}>--</span>
        {canUserActOnStage && (
          <div className={styles.stageAction}>
            <StageActionButton
              departmentName={department.name}
              action="started"
              disabled={!canAct || loadingRequestId === request.id}
              loading={loadingRequestId === request.id}
              onClick={() => onTransition(request.id, department.id, 'started')}
            />
          </div>
        )}
      </td>
    );
  }

  if (isStarted && !isCompleted) {
    return (
      <td className={styles.stageCell}>
        <div className={`${styles.stageTimestamp} ${styles.stageStarted}`}>
          <span className={styles.label}>Started</span>
          <span className={styles.time}> at {formatTimestamp(startTransition!.actionedAt)}</span>
        </div>
        {canUserActOnStage && (
          <div className={styles.stageAction}>
            <StageActionButton
              departmentName={department.name}
              action="completed"
              disabled={!canAct || loadingRequestId === request.id}
              loading={loadingRequestId === request.id}
              onClick={() => onTransition(request.id, department.id, 'completed')}
            />
          </div>
        )}
      </td>
    );
  }

  // Completed
  return (
    <td className={styles.stageCell}>
      <div className={`${styles.stageTimestamp} ${styles.stageCompleted}`}>
        <span className={styles.label}>Done</span>
        <span className={styles.time}> at {formatTimestamp(completeTransition!.actionedAt)}</span>
      </div>
    </td>
  );
}
