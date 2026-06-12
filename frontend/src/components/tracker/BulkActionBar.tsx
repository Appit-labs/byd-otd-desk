import { useState, useMemo } from 'react';
import { Play, X, AlertCircle } from 'lucide-react';
import type { CarRequest, Department } from '@/types/request';
import styles from './tracker.module.css';

interface BulkActionBarProps {
  selectedCount: number;
  departments: Department[];
  requests: CarRequest[];
  onCancel: () => void;
  onBulkAction: (departmentId: number, action: 'started' | 'completed') => void;
  isLoading: boolean;
}

export function BulkActionBar({
  selectedCount,
  departments,
  requests,
  onCancel,
  onBulkAction,
  isLoading,
}: BulkActionBarProps) {
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [action, setAction] = useState<'started' | 'completed'>('started');

  const validationMessage = useMemo(() => {
    if (!selectedDept) return null;
    const deptId = Number(selectedDept);

    const invalidRequests = requests.filter((r) => {
      // Request must not be on_hold
      if (r.status === 'on_hold') return true;

      // Check previous stage completion
      const dept = departments.find((d) => d.id === deptId);
      if (!dept) return true;

      const previousDepartmentTransitions = r.transitions.filter(
        (t) => t.department.pipelineOrder < dept.pipelineOrder
      );
      const previousCompleted = previousDepartmentTransitions.some((t) => t.action === 'completed');
      const isFirst = previousDepartmentTransitions.length === 0;

      // Check if already completed
      const thisDeptTransition = r.transitions.find(
        (t) => t.departmentId === deptId && t.action === 'completed'
      );
      if (thisDeptTransition) return true;

      // Validate the action
      if (action === 'started') {
        const alreadyStarted = r.transitions.some(
          (t) => t.departmentId === deptId && t.action === 'started'
        );
        if (alreadyStarted) return true;
      }
      if (action === 'completed') {
        const started = r.transitions.some(
          (t) => t.departmentId === deptId && t.action === 'started'
        );
        if (!started) return true;
      }

      return !(isFirst || previousCompleted);
    });

    if (invalidRequests.length > 0) {
      const numbers = invalidRequests.map((r) => r.requestNumber).join(', ');
      return `${invalidRequests.length} request(s) cannot transition: ${numbers}`;
    }
    return null;
  }, [selectedDept, action, requests, departments]);

  const canApply = selectedDept && !validationMessage && selectedCount > 0 && !isLoading;

  const handleApply = () => {
    if (!selectedDept || !canApply) return;
    onBulkAction(Number(selectedDept), action);
  };

  return (
    <div className={styles.bulkBar} role="status" aria-live="polite">
      <div className={styles.bulkBarLeft}>
        <span className={styles.bulkCount}>
          {selectedCount} {selectedCount === 1 ? 'request' : 'requests'} selected
        </span>
        <select
          className={styles.filterSelect}
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          aria-label="Select department"
        >
          <option value="">Select department...</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={action}
          onChange={(e) => setAction(e.target.value as 'started' | 'completed')}
          aria-label="Select action"
        >
          <option value="started">Take to</option>
          <option value="completed">Complete</option>
        </select>
        {validationMessage && (
          <span className={styles.bulkValidationError}>
            <AlertCircle size={14} />
            {validationMessage}
          </span>
        )}
      </div>
      <div className={styles.bulkBarRight}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnStart}`}
          disabled={!canApply}
          onClick={handleApply}
          aria-busy={isLoading}
        >
          <Play size={14} />
          {isLoading ? 'Processing...' : `Apply to ${selectedCount}`}
        </button>
        <button
          className={`${styles.actionBtn}`}
          style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
          onClick={onCancel}
          disabled={isLoading}
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}
