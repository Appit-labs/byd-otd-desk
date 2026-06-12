import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  title?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, headerActions, children, className }: CardProps) {
  return (
    <div className={`${styles.card} ${className ?? ''}`}>
      {(title || headerActions) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {headerActions && <div className={styles.actions}>{headerActions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
