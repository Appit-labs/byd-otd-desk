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

  return (
    <div className={styles.card}>
      {/* Edit button for super_admin */}
      {onEditRequest && userRole === 'super_admin' && (
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
          <span className={styles.label}>Car Number</span>
          <span className={styles.value}>{request.carNumber}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Body Number</span>
          <span className={styles.value}>{request.bodyNumber || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Car Color</span>
          <span className={styles.value}>{request.carColor?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Car Spec</span>
          <span className={styles.value}>{request.carSpec?.label || '--'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Request Type</span>
          <span className={styles.value}>{request.requestType.label}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Client Name</span>
          <span className={styles.value}>{request.clientName}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Telephone</span>
          <span className={styles.value}>{request.clientTel}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Payment Method</span>
          <span className={styles.value}>{request.paymentMethod.label}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Seller</span>
          <span className={styles.value}>{request.seller.fullName}</span>
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
