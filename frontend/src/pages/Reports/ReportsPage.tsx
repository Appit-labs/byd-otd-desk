import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { useAuthStore } from '@/stores/auth.store';
import {
  useReportsSummary,
  usePdiAvgDuration,
  useAccessoriesAvgDuration,
  useRequestsByBrand,
  useRequestsByType,
  useRequestsByModel,
  useRequestsByConsultant,
  secondsToDays,
} from '@/hooks/useReports';
import { Skeleton } from '@/components/ui/Skeleton';
import type {
  AvgDurationPoint,
  BrandCountPoint,
  GroupedCount,
} from '@/hooks/useReports';
import styles from './reports.module.css';

// ── Constants ────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a',
  '#0891b2', '#ca8a04', '#4f46e5', '#be123c', '#15803d',
];

const SEVEN_DAYS_LABEL = '7-day target';

function formatPeriodLabel(raw: string, period: 'monthly' | 'daily'): string {
  if (period === 'daily') {
    // raw is YYYY-MM-DD → "Jun 17"
    const d = new Date(raw + 'T00:00:00');
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // raw is YYYY-MM → "Jun 2026"
  const [y, m] = raw.split('-');
  if (!y || !m) return raw;
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

type Period = 'monthly' | 'daily';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDays(seconds: number): string {
  const days = secondsToDays(seconds);
  return `${days}d`;
}

function exceedsTarget(seconds: number): boolean {
  return seconds > 7 * 24 * 60 * 60;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);

  // Gate: only admin and super_admin
  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <AlertTriangle size={40} />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p>You do not have permission to view the Reports page.</p>
        </div>
      </div>
    );
  }

  return <ReportsContent />;
}

// ── Content ──────────────────────────────────────────────────────────────

function ReportsContent() {
  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [pdiPeriod, setPdiPeriod] = useState<Period>('monthly');
  const [accPeriod, setAccPeriod] = useState<Period>('monthly');
  const [brandGranularity, setBrandGranularity] = useState<Period>('monthly');

  const summaryQuery = useReportsSummary(selectedMonth);
  const pdiQuery = usePdiAvgDuration(pdiPeriod);
  const accQuery = useAccessoriesAvgDuration(accPeriod);
  const brandQuery = useRequestsByBrand(brandGranularity);
  const typeQuery = useRequestsByType();
  const modelQuery = useRequestsByModel();
  const consultantQuery = useRequestsByConsultant();

  const isLoading =
    summaryQuery.isLoading ||
    pdiQuery.isLoading ||
    accQuery.isLoading ||
    brandQuery.isLoading ||
    typeQuery.isLoading ||
    modelQuery.isLoading ||
    consultantQuery.isLoading;

  const hasError =
    summaryQuery.error ||
    pdiQuery.error ||
    accQuery.error ||
    brandQuery.error ||
    typeQuery.error ||
    modelQuery.error ||
    consultantQuery.error;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reports</h1>
          <p className={styles.chartSubtitle}>
            Performance analytics and breakdowns
          </p>
        </div>
        {/* Month selector for summary */}
        <div className={styles.monthPicker}>
          <label htmlFor="report-month" className={styles.monthLabel}>
            Month:
          </label>
          <input
            id="report-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={styles.monthInput}
          />
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
            Failed to load some reports data. Please try refreshing the page.
          </span>
        </motion.div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Summary Cards */}
          <SummaryCards summary={summaryQuery.data} selectedMonth={selectedMonth} />

          {/* Charts Grid */}
          <div className={styles.chartsGrid}>
            <PdiDurationChart
              data={pdiQuery.data?.data}
              targetSeconds={pdiQuery.data?.targetSeconds}
              period={pdiPeriod}
              onPeriodChange={setPdiPeriod}
            />
            <AccDurationChart
              data={accQuery.data?.data}
              targetSeconds={accQuery.data?.targetSeconds}
              period={accPeriod}
              onPeriodChange={setAccPeriod}
            />
            <BrandChart
              data={brandQuery.data}
              granularity={brandGranularity}
              onGranularityChange={setBrandGranularity}
            />
            <TypeChart data={typeQuery.data} />
            <ModelChart data={modelQuery.data} />
            <ConsultantChart data={consultantQuery.data} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Summary Cards ────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  selectedMonth,
}: {
  summary?: {
    totalRequests: number;
    avgPdiDurationSeconds: number;
    avgAccessoriesDurationSeconds: number;
  };
  selectedMonth: string;
}) {
  const total = summary?.totalRequests ?? 0;
  const pdiAvg = summary?.avgPdiDurationSeconds ?? 0;
  const accAvg = summary?.avgAccessoriesDurationSeconds ?? 0;
  const pdiExceeds = exceedsTarget(pdiAvg);
  const accExceeds = exceedsTarget(accAvg);

  // Format the month for display (e.g., "2026-06" -> "June 2026")
  const [y, m] = selectedMonth.split('-');
  const monthDate = new Date(parseInt(y), parseInt(m) - 1, 1);
  const monthLabel = format(monthDate, 'MMMM yyyy');

  return (
    <div className={styles.summaryCards}>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Total Requests</span>
        <span className={styles.cardValue}>{total.toLocaleString()}</span>
        <span className={styles.cardSubtext}>
          Requests created in {monthLabel}
        </span>
      </div>

      <div className={styles.card}>
        <span className={styles.cardLabel}>Avg PDI Duration</span>
        <span
          className={styles.cardValue}
          style={{ color: pdiExceeds ? 'var(--color-danger)' : undefined }}
        >
          {formatDays(pdiAvg)}
        </span>
        <span className={styles.cardSubtext}>
          Target: {SEVEN_DAYS_LABEL}
        </span>
        {pdiExceeds && (
          <span className={styles.cardWarning}>
            <AlertTriangle size={14} />
            Exceeds 7-day target
          </span>
        )}
      </div>

      <div className={styles.card}>
        <span className={styles.cardLabel}>Avg Accessories Duration</span>
        <span
          className={styles.cardValue}
          style={{ color: accExceeds ? 'var(--color-danger)' : undefined }}
        >
          {formatDays(accAvg)}
        </span>
        <span className={styles.cardSubtext}>
          Target: {SEVEN_DAYS_LABEL}
        </span>
        {accExceeds && (
          <span className={styles.cardWarning}>
            <AlertTriangle size={14} />
            Exceeds 7-day target
          </span>
        )}
      </div>
    </div>
  );
}

// ── Period Toggle (shared) ───────────────────────────────────────────────

function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className={styles.toggleGroup}>
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.toggleButton} ${
            period === opt.value ? styles.toggleButtonActive : ''
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── PDI Duration Chart ───────────────────────────────────────────────────

function PdiDurationChart({
  data,
  targetSeconds,
  period,
  onPeriodChange,
}: {
  data?: AvgDurationPoint[];
  targetSeconds?: number;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        period: formatPeriodLabel(d.period, period),
        days: secondsToDays(d.avgDurationSeconds),
        requests: d.count,
      })),
    [data, period],
  );

  const targetDays = targetSeconds ? secondsToDays(targetSeconds) : 7;

  return (
    <div className={styles.chartSection}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>PDI — Avg Completion Time</h3>
          <p className={styles.chartSubtitle}>
            {period === 'monthly' ? 'Monthly' : 'Daily'} averages with 7-working-day target
          </p>
        </div>
        <PeriodToggle period={period} onChange={onPeriodChange} />
      </div>
      <div className={styles.chartBody}>
        {chartData.length === 0 ? (
          <EmptyState text="No PDI data available" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                label={{
                  value: 'Days',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'var(--color-text-muted)', fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-primary-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
                formatter={(val) => [`${val} days`]}
              />
              <Legend />
              <Bar
                dataKey="days"
                name="Avg Days"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
              />
              <ReferenceLine
                y={targetDays}
                stroke="var(--color-danger)"
                strokeDasharray="5 5"
                label={{
                  value: `${SEVEN_DAYS_LABEL} (${targetDays}d)`,
                  position: 'top',
                  fill: 'var(--color-danger)',
                  fontSize: 11,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Accessories Duration Chart ───────────────────────────────────────────

function AccDurationChart({
  data,
  targetSeconds,
  period,
  onPeriodChange,
}: {
  data?: AvgDurationPoint[];
  targetSeconds?: number;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        period: formatPeriodLabel(d.period, period),
        days: secondsToDays(d.avgDurationSeconds),
        requests: d.count,
      })),
    [data, period],
  );

  const targetDays = targetSeconds ? secondsToDays(targetSeconds) : 7;

  return (
    <div className={styles.chartSection}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Accessories — Avg Completion Time</h3>
          <p className={styles.chartSubtitle}>
            {period === 'monthly' ? 'Monthly' : 'Daily'} averages with 7-working-day target
          </p>
        </div>
        <PeriodToggle period={period} onChange={onPeriodChange} />
      </div>
      <div className={styles.chartBody}>
        {chartData.length === 0 ? (
          <EmptyState text="No accessories data available" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                label={{
                  value: 'Days',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'var(--color-text-muted)', fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-primary-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
                formatter={(val) => [`${val} days`]}
              />
              <Legend />
              <Bar
                dataKey="days"
                name="Avg Days"
                fill="#7c3aed"
                radius={[4, 4, 0, 0]}
              />
              <ReferenceLine
                y={targetDays}
                stroke="var(--color-danger)"
                strokeDasharray="5 5"
                label={{
                  value: `${SEVEN_DAYS_LABEL} (${targetDays}d)`,
                  position: 'top',
                  fill: 'var(--color-danger)',
                  fontSize: 11,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Requests by Brand ────────────────────────────────────────────────────

function BrandChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data?: BrandCountPoint[];
  granularity: Period;
  onGranularityChange: (g: Period) => void;
}) {
  // Transform: pivot brand counts into series by period -> { period, BrandA: n, BrandB: m }
  const { chartData, brands } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], brands: [] };

    const periodSet = new Set<string>();
    const brandSet = new Set<string>();
    for (const d of data) {
      periodSet.add(d.period);
      brandSet.add(d.brand);
    }
    const periods = Array.from(periodSet).sort();
    const brandList = Array.from(brandSet);

    const pivoted = periods.map((period) => {
      const row: Record<string, string | number> = { period };
      for (const brand of brandList) {
        row[brand] = 0;
      }
      for (const d of data) {
        if (d.period === period) {
          row[d.brand] = d.count;
        }
      }
      return row;
    });

    return { chartData: pivoted, brands: brandList.slice(0, 8) };
  }, [data]);

  return (
    <div className={`${styles.chartSection} ${styles.chartSectionFull}`}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Requests by Vehicle Brand</h3>
          <p className={styles.chartSubtitle}>
            {granularity === 'monthly' ? 'Monthly' : 'Daily'} request volume broken down by brand
          </p>
        </div>
        <PeriodToggle period={granularity} onChange={onGranularityChange} />
      </div>
      <div className={styles.chartBody}>
        {chartData.length === 0 ? (
          <EmptyState text="No brand data available" />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-primary-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <Legend />
              {brands.map((brand, idx) => (
                <Bar
                  key={brand}
                  dataKey={brand}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Requests by Type ─────────────────────────────────────────────────────

function TypeChart({ data }: { data?: GroupedCount[] }) {
  return (
    <div className={styles.chartSection}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Requests by Request Type</h3>
      </div>
      <div className={styles.chartBody}>
        {!data || data.length === 0 ? (
          <EmptyState text="No type data available" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-primary-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Requests by Model ────────────────────────────────────────────────────

function ModelChart({ data }: { data?: GroupedCount[] }) {
  const isMobile = useIsMobile();
  return (
    <div className={styles.chartSection}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Requests by Vehicle Model</h3>
      </div>
      <div className={styles.chartBody}>
        {!data || data.length === 0 ? (
          <EmptyState text="No model data available" />
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: isMobile ? 10 : 12, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={isMobile ? 80 : 120}
                tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--color-text-muted)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-primary-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <Bar
                dataKey="count"
                fill="#16a34a"
                radius={[0, 4, 4, 0]}
                name="Requests"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Requests by Consultant ───────────────────────────────────────────────

function ConsultantChart({ data }: { data?: GroupedCount[] }) {
  const isMobile = useIsMobile();
  return (
    <div className={`${styles.chartSection} ${styles.chartSectionFull}`}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Requests by Sales Consultant</h3>
          <p className={styles.chartSubtitle}>
            Total requests assigned per consultant
          </p>
        </div>
      </div>
      <div className={styles.chartBody}>
        {!data || data.length === 0 ? (
          <EmptyState text="No consultant data available" />
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 340}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: isMobile ? 10 : 12, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={isMobile ? 90 : 150}
                tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--color-text-muted)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-primary-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <Bar
                dataKey="count"
                fill="#ea580c"
                radius={[0, 4, 4, 0]}
                name="Requests"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Loading / Empty States ───────────────────────────────────────────────

function LoadingState() {
  return (
    <>
      <div className={styles.summaryCards}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="card" height="120px" />
        ))}
      </div>
      <div className={styles.chartsGrid}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} variant="card" height="320px" />
        ))}
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyText}>{text}</p>
    </div>
  );
}
