import { useState } from 'react';
import { Play, X } from 'lucide-react';
import type { CarRequest } from '@/types/request';
import styles from './tracker.module.css';

interface BulkActionBarProps {
  selectedRequests: CarRequest[];
  userRole: string;
  onCancel: () => void;
  onBulkAction: (stage: string, action: 'start' | 'complete' | 'confirm') => Promise<void>;
}

const STAGE_OPTIONS = [
  { value: 'storage', label: 'Storage — Dispatch Vehicle' },
  { value: 'vehicle_received', label: 'Vehicle Received' },
  { value: 'mechanical_check', label: 'Mechanical Check' },
  { value: 'pdi', label: 'PDI' },
  { value: 'sent_to_accessories', label: 'Sent to Accessories' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'final_inspection', label: 'Final Inspection' },
  { value: 'gps', label: 'GPS' },
  { value: 'registration', label: 'Registration' },
  { value: 'delivery', label: 'Delivery' },
];

export function BulkActionBar({
  selectedRequests,
  onCancel,
  onBulkAction,
}: BulkActionBarProps) {
  const [selectedStage, setSelectedStage] = useState('');
  const [action, setAction] = useState<'start' | 'complete' | 'confirm'>('start');
  const [isLoading, setIsLoading] = useState(false);

  const count = selectedRequests.length;

  const handleApply = async () => {
    if (!selectedStage || count === 0) return;
    setIsLoading(true);
    try {
      await onBulkAction(selectedStage, action);
    } finally {
      setIsLoading(false);
    }
  };

  const canApply = selectedStage && count > 0 && !isLoading;

  return (
    <div className={styles.bulkBar} role="status" aria-live="polite">
      <div className={styles.bulkBarLeft}>
        <span className={styles.bulkCount}>
          {count} {count === 1 ? 'request' : 'requests'} selected
        </span>
        <select
          className={styles.filterSelect}
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value)}
          aria-label="Select stage"
        >
          <option value="">Select stage...</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={action}
          onChange={(e) => setAction(e.target.value as 'start' | 'complete' | 'confirm')}
          aria-label="Select action"
        >
          <option value="start">Start</option>
          <option value="complete">Complete</option>
          <option value="confirm">Confirm</option>
        </select>
      </div>
      <div className={styles.bulkBarRight}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnStart}`}
          disabled={!canApply}
          onClick={handleApply}
          aria-busy={isLoading}
        >
          <Play size={14} />
          {isLoading ? 'Processing...' : `Apply to ${count}`}
        </button>
        <button
          className={styles.actionBtn}
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
