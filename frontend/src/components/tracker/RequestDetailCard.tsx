import { Edit3 } from 'lucide-react';
import type { CarRequest } from '@/types/request';
import { Badge } from '@/components/ui/Badge';
import styles from './detailCard.module.css';

interface RequestDetailCardProps {
  request: CarRequest;
  onEditRequest?: (request: CarRequest) => void;
  userRole?: string;
}

export function RequestDetailCard({ request, onEditRequest, userRole }: RequestDetailCardProps) {
  const createdAt = new Date(request.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const promiseDate = request.promiseDate
    ? new Date(request.promiseDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '--';

  const canEdit = userRole === 'super_admin' || userRole === 'admin';

  return (
    <div className={styles.card}>
      {onEditRequest && canEdit && (
        <div style={{ marginBottom: 'var(--spacing-3)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onEditRequest(request)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-1)',
              padding: 'var(--spacing-1) var(--spacing-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)';
              e.currentTarget.style.borderColor = 'var(--color-accent)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'var(--color-text-muted)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
            aria-label={`Edit ${request.requestNumber}`}
          >
            <Edit3 size={12} />
            Edit
          </button>
        </div>
      )}
      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.label}>Request Number</span>
          <span className={styles.value}>{request.requestNumber}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Chassis Number (VIN)</span>
          <span className={styles.value}>{request.chassisNumber}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Request Type</span>
          <span className={styles.value}>{request.requestType?.label ?? '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Brand</span>
          <span className={styles.value}>{request.brand?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Model</span>
          <span className={styles.value}>{request.model?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Variant</span>
          <span className={styles.value}>{request.variant?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Exterior Color</span>
          <span className={styles.value}>{request.exteriorColor?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Interior Color</span>
          <span className={styles.value}>{request.interiorColor?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Vehicle Location</span>
          <span className={styles.value}>{request.vehicleLocation || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Customer Name</span>
          <span className={styles.value}>{request.customerName}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Phone</span>
          <span className={styles.value}>{request.customerPhone}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Sales Consultant</span>
          <span className={styles.value}>{request.salesConsultant?.label ?? '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Sales Type</span>
          <span className={styles.value}>{request.salesType?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>GPS</span>
          <span className={styles.value}>{request.hasGps ? 'Yes' : 'No'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Promise Date</span>
          <span className={styles.value} style={{ color: 'var(--color-accent)' }}>
            {promiseDate}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Created At</span>
          <span className={styles.value}>{createdAt}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Status</span>
          <Badge variant={request.status} label={request.status.replace('_', ' ')} />
        </div>
      </div>
      {request.remarks && (
        <div className={styles.remarks}>
          <span className={styles.label}>Remarks</span>
          <p className={styles.remarksText}>{request.remarks}</p>
        </div>
      )}
    </div>
  );
}
