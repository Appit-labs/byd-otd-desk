import { motion } from 'motion/react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/auth.store';
import sharedStyles from './dashboard-shared.module.css';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getFormattedDate(): string {
  return format(new Date(), 'EEEE, MMMM d, yyyy');
}

interface WelcomeCardProps {
  activeRequestCount: number;
}

export function WelcomeCard({ activeRequestCount }: WelcomeCardProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.fullName ?? user?.username ?? 'User';
  const greeting = getGreeting();
  const formattedDate = getFormattedDate();

  return (
    <motion.div
      className={sharedStyles.cardWrapper}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        gridArea: 'welcome',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {greeting}, {displayName}
      </p>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          margin: 'var(--spacing-1) 0 var(--spacing-4)',
        }}
      >
        {formattedDate}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'var(--color-accent-alt)',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {activeRequestCount} active request{activeRequestCount !== 1 ? 's' : ''} today
        </span>
      </div>
    </motion.div>
  );
}
