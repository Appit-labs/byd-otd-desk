import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { ComparisonDay } from '@/hooks/useDashboard';

interface ComparisonBarChartProps {
  data: ComparisonDay[];
  isLoading: boolean;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  fill: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-xs)',
          margin: '0 0 var(--spacing-2)',
          fontWeight: 600,
        }}
      >
        Day {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            marginBottom: 'var(--spacing-1)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: entry.fill,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {entry.name}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ComparisonBarChart({ data, isLoading }: ComparisonBarChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => ({
      day: d.day,
      'This Month': d.currentMonth,
      'Last Month': d.previousMonth,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card title="Requests Comparison">
        <div
          style={{
            height: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="sharedStyles__skeletonBlock" />
        </div>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card title="Requests Comparison">
        <div
          style={{
            height: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          No comparison data available
        </div>
      </Card>
    );
  }

  return (
    <Card title="Requests Comparison">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barGap={2} barCategoryGap="20%">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
            label={{
              value: 'Day of Month',
              position: 'insideBottom',
              offset: -4,
              fill: 'var(--color-text-muted)',
              fontSize: 11,
            }}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar
            dataKey="This Month"
            fill="#00C2FF"
            radius={[3, 3, 0, 0]}
            maxBarSize={12}
          />
          <Bar
            dataKey="Last Month"
            fill="#6B7A99"
            radius={[3, 3, 0, 0]}
            maxBarSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
