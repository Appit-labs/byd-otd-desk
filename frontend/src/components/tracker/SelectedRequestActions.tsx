import { useState } from 'react';
import { Play, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { CarRequest, Department, RequestStageTransition } from '@/types/request';
import styles from './tracker.module.css';

interface SelectedRequestActionsProps {
  request: CarRequest;
  departments: Department[];
  userRole: string;
  userDepartmentId?: number;
  onTransition: (requestId: number, deptId: number, action: 'started' | 'completed') => void;
  isLoading: boolean;
}

function getStageState(
  transitions: RequestStageTransition[],
  deptId: number
): 'empty' | 'started' | 'completed' {
  const deptTransitions = transitions.filter((t) => t.departmentId === deptId);
  if (deptTransitions.some((t) => t.action === 'completed')) return 'completed';
  if (deptTransitions.some((t) => t.action === 'started')) return 'started';
  return 'empty';
}

function getNextAction(
  request: CarRequest,
  departments: Department[],
  userRole: string,
  userDepartmentId?: number
): { dept: Department; action: 'started' | 'completed' } | null {
  if (request.status === 'on_hold') return null;

  const sorted = [...departments].sort((a, b) => a.pipelineOrder - b.pipelineOrder);

  for (const dept of sorted) {
    // Skip departments the user can't act on
    const canAct =
      userRole === 'super_admin' ||
      (userRole === 'department_user' && userDepartmentId === dept.id);
    if (!canAct) continue;

    const state = getStageState(request.transitions ?? [], dept.id);

    if (state === 'empty') {
      // Check if previous stage completed (or it's the first stage)
      if (dept.pipelineOrder === 1) {
        return { dept, action: 'started' };
      }
      const prevDept = sorted.find((d) => d.pipelineOrder === dept.pipelineOrder - 1);
      if (prevDept && getStageState(request.transitions ?? [], prevDept.id) === 'completed') {
        return { dept, action: 'started' };
      }
      return null; // Previous stage not done yet — stop here
    }

    if (state === 'started') {
      return { dept, action: 'completed' };
    }
    // If completed, continue to next department
  }

  return null; // All done or no actions available
}

export function SelectedRequestActions({
  request,
  departments,
  userRole,
  userDepartmentId,
  onTransition,
  isLoading,
}: SelectedRequestActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nextAction = getNextAction(request, departments, userRole, userDepartmentId);

  if (!nextAction) {
    if (request.status === 'completed') {
      return (
        <div className={styles.actionToolbar}>
          <span className={styles.actionToolbarTitle}>
            {request.requestNumber} — ✓ Completed
          </span>
        </div>
      );
    }
    if (request.status === 'on_hold') {
      return (
        <div className={styles.actionToolbar}>
          <span className={styles.actionToolbarTitle}>
            {request.requestNumber} — ⏸ On Hold
          </span>
        </div>
      );
    }
    return null;
  }

  const actionLabel =
    nextAction.action === 'started'
      ? `Take to ${nextAction.dept.name}`
      : `Mark ${nextAction.dept.name} Complete`;

  const handleConfirm = () => {
    onTransition(request.id, nextAction.dept.id, nextAction.action);
    setConfirmOpen(false);
  };

  return (
    <>
      <div className={styles.actionToolbar}>
        <span className={styles.actionToolbarTitle}>
          {request.requestNumber} — {request.clientName}
        </span>
        <div className={styles.actionToolbarProgress}>
          {[...departments]
            .sort((a, b) => a.pipelineOrder - b.pipelineOrder)
            .map((dept) => {
              const s = getStageState(request.transitions ?? [], dept.id);
              return (
                <span
                  key={dept.id}
                  className={`${styles.progressDot} ${
                    s === 'completed'
                      ? styles.progressDotDone
                      : s === 'started'
                        ? styles.progressDotActive
                        : styles.progressDotEmpty
                  }`}
                  title={`${dept.name}: ${s}`}
                />
              );
            })}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          loading={isLoading}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : nextAction.action === 'started' ? (
            <Play size={14} />
          ) : (
            <Check size={14} />
          )}
          {actionLabel}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Confirm ${nextAction.action === 'started' ? 'Start' : 'Complete'}`}
      >
        <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
          {actionLabel} for {request.requestNumber}?
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
}
