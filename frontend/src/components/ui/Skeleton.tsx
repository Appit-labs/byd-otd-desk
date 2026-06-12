import styles from './Skeleton.module.css';

type SkeletonVariant = 'text' | 'title' | 'avatar' | 'card' | 'tableRow';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({
  variant = 'text',
  className,
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${className ?? ''}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
