import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <span
      className={`${styles.spinner} ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
