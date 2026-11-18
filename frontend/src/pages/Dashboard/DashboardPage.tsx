import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import {
  useDashboardStats,
  useDashboardComparison,
  usePipelineSummary,
} from '@/hooks/useDashboard';
import { useRequests } from '@/hooks/useRequests';
import { useAuthStore } from '@/stores/auth.store';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ComparisonBarChart } from '@/components/dashboard/ComparisonBarChart';
import { PipelineFunnelChart } from '@/components/dashboard/PipelineFunnelChart';
import { RecentRequestsTable } from '@/components/dashboard/RecentRequestsTable';
import { Skeleton } from '@/components/ui/Skeleton';
import sharedStyles from '@/components/dashboard/dashboard-shared.module.css';
import styles from './dashboard.module.css';

type Period = 'daily' | 'monthly';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'monthly', label: 'This Month' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  // Dashboard is for all authenticated users except viewer
  if (!user || user.role === 'viewer') {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <p>You do not have access to the Dashboard page.</p>
        </div>
      </div>
    );
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const [period, setPeriod] = useState<Period>('daily');
  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);

  const statsQuery = useDashboardStats(period);
  const comparisonQuery = useDashboardComparison(currentMonth);
  const pipelineQuery = usePipelineSummary();
  const recentQuery = useRequests({ limit: 10, sortBy: 'created_at', sortOrder: 'DESC' });

  const isLoading =
    statsQuery.isLoading ||
    comparisonQuery.isLoading ||
    pipelineQuery.isLoading ||
    recentQuery.isLoading;

  const hasError =
    statsQuery.error || comparisonQuery.error || pipelineQuery.error || recentQuery.error;

  // Determine active request count from stats
  const activeRequestCount = statsQuery.data?.totalRequests ?? 0;

  // Determine completion rate color
  const completionRate = statsQuery.data?.completionRate ?? 0;
  const completionColor =
    completionRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <div className={styles.toggleGroup}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.toggleButton} ${
                period === opt.value ? styles.toggleButtonActive : ''
              }`}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {hasError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            backgroundColor: 'var(--overlay-danger)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-danger)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--spacing-4)',
          }}
          role="alert"
        >
          <AlertCircle size={16} />
          <span>
            Failed to load some dashboard data. Please try refreshing the page.
          </span>
        </motion.div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <LoadingGrid isAdmin={isAdmin} />
      ) : isAdmin ? (
        /* ═══════════ Admin / Super Admin — full dashboard ═══════════ */
        <div className={styles.grid}>
          {/* Welcome Card */}
          <div style={{ gridArea: 'welcome' }}>
            <WelcomeCard activeRequestCount={activeRequestCount} />
          </div>

          {/* Daily Requests / Completed Stats */}
          <div style={{ gridArea: 'daily-requests' }}>
            <StatsCard
              title="Total Requests"
              value={statsQuery.data?.totalRequests ?? 0}
              trend={statsQuery.data?.trend ?? 0}
              subtitle={
                period === 'daily'
                  ? 'Requests created today'
                  : 'Requests created this month'
              }
              accentColor="var(--color-accent)"
              delay={0.05}
            />
          </div>

          <div style={{ gridArea: 'completed' }}>
            <StatsCard
              title="Completion Rate"
              value={completionRate}
              trend={statsQuery.data?.trend ?? 0}
              subtitle={
                period === 'daily'
                  ? 'Requests completed today'
                  : `Requests completed this month`
              }
              accentColor={completionColor}
              delay={0.1}
            />
          </div>

          {/* Comparison Chart */}
          <div style={{ gridArea: 'chart' }}>
            <ComparisonBarChart
              data={comparisonQuery.data?.days ?? []}
              isLoading={comparisonQuery.isLoading}
            />
          </div>

          {/* Pipeline Funnel */}
          <div style={{ gridArea: 'pipeline' }}>
            <PipelineFunnelChart
              data={pipelineQuery.data ?? []}
              isLoading={pipelineQuery.isLoading}
            />
          </div>

          {/* Recent Requests */}
          <div style={{ gridArea: 'recent' }}>
            <RecentRequestsTable
              requests={recentQuery.data?.items ?? []}
              isLoading={recentQuery.isLoading}
            />
          </div>
        </div>
      ) : (
        /* ═══════════ Operational roles — Welcome + Pending Actions ═══════════ */
        <div className={styles.grid}>
          <div style={{ gridArea: 'welcome' }}>
            <WelcomeCard activeRequestCount={activeRequestCount} />
          </div>
          <div style={{ gridArea: 'daily-requests' }}>
            <div className={sharedStyles.cardWrapper}>
              <p className={sharedStyles.cardTitle}>PENDING ACTIONS</p>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-3xl)',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
                lineHeight: 1.1,
              }}>
                {statsQuery.data?.pendingActions ?? 0}
              </p>
              <p style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-xs)',
                marginTop: 'var(--spacing-2)',
                marginBottom: 0,
              }}>
                Requests waiting for your action
              </p>
              <div style={{
                marginTop: 'var(--spacing-3)',
                height: 3,
                width: '40px',
                borderRadius: 2,
                backgroundColor: 'var(--color-accent)',
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingGrid({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) {
    return (
      <div className={styles.grid}>
        <div style={{ gridArea: 'welcome' }}>
          <Skeleton variant="card" height="160px" />
        </div>
        <div style={{ gridArea: 'daily-requests' }}>
          <Skeleton variant="card" height="160px" />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.grid}>
      <div style={{ gridArea: 'welcome' }}>
        <Skeleton variant="card" height="160px" />
      </div>
      <div style={{ gridArea: 'daily-requests' }}>
        <Skeleton variant="card" height="160px" />
      </div>
      <div style={{ gridArea: 'completed' }}>
        <Skeleton variant="card" height="160px" />
      </div>
      <div style={{ gridArea: 'chart' }}>
        <Skeleton variant="card" height="340px" />
      </div>
      <div style={{ gridArea: 'pipeline' }}>
        <Skeleton variant="card" height="340px" />
      </div>
      <div style={{ gridArea: 'recent' }}>
        <Skeleton variant="card" height="340px" />
      </div>
    </div>
  );
}
