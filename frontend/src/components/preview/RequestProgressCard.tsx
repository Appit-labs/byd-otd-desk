import { useState, useCallback } from 'react';
import { Copy, Check, Car, Phone, Clock } from 'lucide-react';

import { AnimatePresence, motion } from 'motion/react';
import type { CarRequest } from '@/types/request';
import { Badge } from '@/components/ui/Badge';
import { RequestDetailCard } from '@/components/tracker/RequestDetailCard';
import { ProgressBar } from './ProgressBar';
import styles from './preview-shared.module.css';

interface RequestProgressCardProps {
  request: CarRequest;
}

function getCurrentStageLabel(req: CarRequest): string | null {
  if (req.status !== 'active') return null;
  const checks: { label: string; done: boolean; skipped: boolean }[] = [
    { label: 'Storage', done: !!req.storageAt, skipped: false },
    { label: 'Vehicle Received', done: !!req.vehicleReceivedAt, skipped: false },
    { label: 'Mech. Check', done: !!req.mechanicalCheckCompletedAt, skipped: false },
    { label: 'PDI', done: !!req.pdiCompletedAt, skipped: req.requestType?.value === 'no_pdi' },
    { label: 'Sent to Acc.', done: !!req.sentToAccessoriesAt, skipped: !req.hasAccessories && (!req.accessories || req.accessories.length === 0) },
    { label: 'Accessories', done: !!req.accessoriesCompletedAt, skipped: !req.hasAccessories && (!req.accessories || req.accessories.length === 0) },
    { label: 'Final Insp.', done: !!req.finalInspectionAt, skipped: false },
    { label: 'GPS', done: !!req.gpsConfirmedAt, skipped: !req.hasGps },
    { label: 'Registration', done: !!req.registeredAt, skipped: false },
    { label: 'Delivery', done: !!req.deliveredAt, skipped: false },
  ];
  for (const c of checks) {
    if (c.skipped) continue;
    if (!c.done) return c.label;
  }
  return 'Completed';
}

export function RequestProgressCard({
  request,
}: RequestProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const currentStageLabel = getCurrentStageLabel(request);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(request.requestNumber).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [request.requestNumber],
  );

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
    if (!showDetail) {
      setShowDetail(true);
    }
  }, [showDetail]);

  const handleAnimationComplete = useCallback(() => {
    if (!expanded) {
      setShowDetail(false);
    }
  }, [expanded]);

  const isCompleted = !!request.deliveredAt || request.status !== 'active';

  const stageTimeText = currentStageLabel
    ? `Current: ${currentStageLabel}`
    : isCompleted ? 'Completed' : null;

  return (
    <div className={styles.cardWrapper}>
      <div
        className={`${styles.progressCard} ${expanded ? styles.expanded : ''} ${isCompleted ? styles.completed : ''}`}
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        aria-expanded={expanded}
        aria-label={`Request ${request.requestNumber}`}
      >
        {/* Header: request number + status */}
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <span className={styles.requestNumber}>
              {request.requestNumber}
            </span>
            <button
              className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
              onClick={handleCopy}
              aria-label={`Copy ${request.requestNumber}`}
              title="Copy request number"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className={styles.statusBadge}>
            <Badge
              variant={request.status}
              label={request.status.replace('_', ' ')}
            />
          </div>
        </div>

        {/* Car number */}
        <div className={styles.cardSectionRow}>
          <Car size={16} className={styles.cardSectionIcon} />
          <span>{request.chassisNumber}</span>
        </div>

        {/* Client name */}
        <div className={styles.cardSectionRow}>
          <Phone size={16} className={styles.cardSectionIcon} />
          <span>{request.customerName}</span>
        </div>

        {/* Progress bar (shared component) */}
        <div className={styles.cardSection}>
          <ProgressBar
            request={request}
            variant="default"
          />
        </div>

        {/* Time in current stage */}
        {stageTimeText && (
          <div className={styles.stageTime}>
            <Clock size={14} />
            <span className={styles.stageTimeDepartment}>
              {stageTimeText}
            </span>
          </div>
        )}

        {/* Expanded detail section */}
        <AnimatePresence initial={false}>
          {expanded && showDetail && (
            <motion.div
              key="detail"
              className={styles.detailSection}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              onAnimationComplete={handleAnimationComplete}
              onClick={(e) => e.stopPropagation()}
            >
              <RequestDetailCard request={request} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
