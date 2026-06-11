import styles from './Badge.module.css';

type BadgeVariant = 'not_started' | 'pending' | 'on_hold' | 'completed' | 'overdue';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const variantLabels: Record<BadgeVariant, string> = {
  not_started: 'Not Started',
  pending: 'Pending',
  on_hold: 'On Hold',
  completed: 'Completed',
  overdue: 'Overdue',
};

export function Badge({ variant, label, className }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className ?? ''}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label || variantLabels[variant]}
    </span>
  );
}
