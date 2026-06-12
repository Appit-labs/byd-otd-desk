import { Play, Check } from 'lucide-react';
import styles from './tracker.module.css';

interface StageActionButtonProps {
  departmentName: string;
  action: 'started' | 'completed';
  disabled: boolean;
  loading?: boolean;
  onClick: () => void;
}

export function StageActionButton({
  departmentName,
  action,
  disabled,
  loading,
  onClick,
}: StageActionButtonProps) {
  if (action === 'started') {
    return (
      <button
        className={`${styles.actionBtn} ${styles.actionBtnStart}`}
        disabled={disabled || loading}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {loading ? (
          '...'
        ) : (
          <>
            <Play size={12} />
            Take to {departmentName}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      className={`${styles.actionBtn} ${styles.actionBtnComplete}`}
      disabled={disabled || loading}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {loading ? (
        '...'
      ) : (
        <>
          <Check size={12} />
          Mark {departmentName} Complete
        </>
      )}
    </button>
  );
}
