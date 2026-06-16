import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CarRequest } from '@/types/request';

interface RecentRequestsTableProps {
  requests: CarRequest[];
  isLoading: boolean;
}

const STATUS_BADGE_MAP: Record<string, 'active' | 'cancelled' | 'archived_manual' | 'archived_qc'> = {
  active: 'active',
  cancelled: 'cancelled',
  archived_manual: 'archived_manual',
  archived_qc: 'archived_qc',
};

export function RecentRequestsTable({ requests, isLoading }: RecentRequestsTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (id: number) => {
    navigate(`/tracker?highlight=${id}`);
  };

  return (
    <Card
      title="Recent Requests"
      headerActions={
        <button
          onClick={() => navigate('/tracker')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-1)',
            padding: 0,
            border: 'none',
            background: 'none',
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          View All
          <ExternalLink size={14} />
        </button>
      }
    >
      {isLoading ? (
        <TableSkeleton />
      ) : requests.length === 0 ? (
        <div
          style={{
            padding: 'var(--spacing-8) 0',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          No recent requests
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--text-sm)',
            }}
          >
            <thead>
              <tr>
                <HeaderCell>Request #</HeaderCell>
                <HeaderCell>Car Number</HeaderCell>
                <HeaderCell>Client</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Created</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const badgeVariant = STATUS_BADGE_MAP[req.status] ?? 'pending';
                return (
                  <tr
                    key={req.id}
                    onClick={() => handleRowClick(req.id)}
                    style={{
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'rgba(255, 255, 255, 0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--color-accent)',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        {req.requestNumber}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {req.chassisNumber}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {req.customerName}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Badge
                        variant={badgeVariant}
                        label={req.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      />
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          color: 'var(--color-text-muted)',
                          fontSize: 'var(--text-xs)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {format(new Date(req.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: 'var(--spacing-2) var(--spacing-3)',
        color: 'var(--color-text-muted)',
        fontWeight: 600,
        fontSize: 'var(--text-xs)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid var(--color-border)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

const tdStyle: React.CSSProperties = {
  padding: 'var(--spacing-2) var(--spacing-3)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

function TableSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-2) 0' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 'var(--spacing-3)',
            padding: 'var(--spacing-3)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              width: '20%',
              height: 14,
              background: 'var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              width: '15%',
              height: 14,
              background: 'var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              animationDelay: '0.1s',
            }}
          />
          <div
            style={{
              width: '20%',
              height: 14,
              background: 'var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              animationDelay: '0.2s',
            }}
          />
          <div
            style={{
              width: '12%',
              height: 14,
              background: 'var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              animationDelay: '0.3s',
            }}
          />
          <div
            style={{
              width: '15%',
              height: 14,
              background: 'var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              animationDelay: '0.4s',
            }}
          />
        </div>
      ))}
    </div>
  );
}
