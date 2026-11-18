import { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { PipelineStage } from '@/hooks/useDashboard';

interface PipelineFunnelChartProps {
  data: PipelineStage[];
  isLoading: boolean;
}

// BYD-inspired gradient colors — teal (primary) → purple → green
const STAGE_COLORS = [
  '#00B4D8', // brand teal (primary accent)
  '#009EC0',
  '#0077B6',
  '#9C27B0', // process purple (secondary accent)
  '#8827B0',
  '#4B3FCF',
  '#00C853', // green (success milestone)
];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
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
          color: 'var(--color-text-primary)',
          fontSize: 'var(--text-sm)',
          margin: 0,
          fontWeight: 600,
        }}
      >
        {payload[0].name}
      </p>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-xs)',
          margin: 'var(--spacing-1) 0 0',
        }}
      >
        {payload[0].value} request{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export function PipelineFunnelChart({ data, isLoading }: PipelineFunnelChartProps) {
  const isMobile = useIsMobile();
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.pipelineOrder - b.pipelineOrder);
  }, [data]);

  if (isLoading) {
    return (
      <Card title="Pipeline Funnel">
        <div
          style={{
            height: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Loading...
          </p>
        </div>
      </Card>
    );
  }

  if (sortedData.length === 0) {
    return (
      <Card title="Pipeline Funnel">
        <div
          style={{
            height: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          No pipeline data available
        </div>
      </Card>
    );
  }

  return (
    <Card title="Pipeline Funnel">
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ left: 20, right: 20, top: 8, bottom: 8 }}
          barCategoryGap="25%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="departmentName"
            tick={{
              fill: 'var(--color-text-primary)',
              fontSize: isMobile ? 11 : 13,
              fontWeight: 500,
            }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 90 : 130}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--overlay-subtle)' }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            maxBarSize={32}
            label={{
              position: 'right',
              fill: 'var(--color-text-muted)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {sortedData.map((stage, idx) => (
              <Cell
                key={stage.slug}
                fill={
                  stage.slug === 'completed'
                    ? '#10B981'
                    : STAGE_COLORS[idx % STAGE_COLORS.length]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sortedData.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-2)',
            marginTop: 'var(--spacing-3)',
          }}
        >
          {sortedData.map((stage, idx) => (
            <div
              key={stage.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-1)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: STAGE_COLORS[idx % STAGE_COLORS.length],
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {stage.departmentName}: {stage.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
