import { motion } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import sharedStyles from './dashboard-shared.module.css';

interface StatsCardProps {
  title: string;
  value: number;
  trend: number;
  subtitle: string;
  accentColor?: string;
  delay?: number;
}

export function StatsCard({
  title,
  value,
  trend,
  subtitle,
  accentColor = 'var(--color-accent)',
  delay = 0.1,
}: StatsCardProps) {
  const isPositive = trend >= 0;
  const trendColor = isPositive ? 'var(--color-accent-alt)' : 'var(--color-danger)';

  return (
    <motion.div
      className={sharedStyles.cardWrapper}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      <p className={sharedStyles.cardTitle}>{title}</p>

      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value.toLocaleString()}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)',
          marginTop: 'var(--spacing-2)',
        }}
      >
        {isPositive ? (
          <TrendingUp size={14} color={trendColor} />
        ) : (
          <TrendingDown size={14} color={trendColor} />
        )}
        <span
          style={{
            color: trendColor,
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
          }}
        >
          {isPositive ? '+' : ''}
          {trend.toFixed(1)}%
        </span>
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-xs)',
            marginLeft: 'var(--spacing-1)',
          }}
        >
          vs yesterday
        </span>
      </div>

      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-xs)',
          marginTop: 'var(--spacing-2)',
          marginBottom: 0,
        }}
      >
        {subtitle}
      </p>

      {/* Accent bar */}
      <div
        style={{
          marginTop: 'var(--spacing-3)',
          height: 3,
          width: '40px',
          borderRadius: 2,
          backgroundColor: accentColor,
        }}
      />
    </motion.div>
  );
}
