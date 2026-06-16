import styles from './Badge.module.css';

type BadgeVariant = 'active' | 'cancelled' | 'archived_manual' | 'archived_qc' | 'overdue' | 'onTime' | 'delayed';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const variantLabels: Record<BadgeVariant, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  archived_manual: 'Archived',
  archived_qc: 'Archived (QC)',
  overdue: 'Overdue',
  onTime: 'On Time',
  delayed: 'Delayed',
};

export function Badge({ variant, label, className }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className ?? ''}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label || variantLabels[variant]}
    </span>
  );
}
