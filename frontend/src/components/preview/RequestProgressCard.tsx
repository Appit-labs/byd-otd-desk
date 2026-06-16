import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, Car, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import type { CarRequest, Department, RequestStageTransition } from '@/types/request';
import { Badge } from '@/components/ui/Badge';
import { RequestDetailCard } from '@/components/tracker/RequestDetailCard';
import { ProgressBar } from './ProgressBar';
import styles from './preview-shared.module.css';

interface RequestProgressCardProps {
  request: CarRequest;
  departments: Department[];
}

function getCurrentStageInfo(
  transitions: RequestStageTransition[],
  departments: Department[],
): { departmentName: string; actionedAt: Date } | null {
  // Find the latest "started" transition without a matching "completed" after it
  const startedWithoutCompleted = transitions
    .filter((t) => t.action === 'started')
    .filter((started) => {
      return !transitions.some(
        (t) =>
          t.action === 'completed' &&
          t.departmentId === started.departmentId &&
          new Date(t.actionedAt) > new Date(started.actionedAt),
      );
    })
    .sort(
      (a, b) =>
        new Date(b.actionedAt).getTime() - new Date(a.actionedAt).getTime(),
    );

  if (startedWithoutCompleted.length === 0) return null;

  const latest = startedWithoutCompleted[0];
  const dept = departments.find((d) => d.id === latest.departmentId);
  return {
    departmentName: dept?.name ?? `Department #${latest.departmentId}`,
    actionedAt: new Date(latest.actionedAt),
  };
}

export function RequestProgressCard({
  request,
  departments,
}: RequestProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const currentStage = useMemo(
    () => getCurrentStageInfo(request.transitions, departments),
    [request.transitions, departments],
  );

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

  const isCompleted = !!request.deliveredAt;

  const stageTimeText = currentStage
    ? `In ${currentStage.departmentName} — ${formatDistanceToNow(currentStage.actionedAt, { addSuffix: true })}`
    : null;

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
            transitions={request.transitions}
            departments={departments}
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
