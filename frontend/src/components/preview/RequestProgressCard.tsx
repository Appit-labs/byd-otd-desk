import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, Car, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import type { CarRequest, Department, RequestStageTransition } from '@/types/request';
import { Badge } from '@/components/ui/Badge';
import { RequestDetailCard } from '@/components/tracker/RequestDetailCard';
import styles from './preview-shared.module.css';

interface RequestProgressCardProps {
  request: CarRequest;
  departments: Department[];
}

function getStageState(
  transitions: RequestStageTransition[],
  deptId: number,
): 'empty' | 'started' | 'completed' {
  const deptTransitions = transitions.filter((t) => t.departmentId === deptId);
  if (deptTransitions.some((t) => t.action === 'completed')) return 'completed';
  if (deptTransitions.some((t) => t.action === 'started')) return 'started';
  return 'empty';
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

  // Sort departments by pipelineOrder
  const sortedDepartments = useMemo(
    () => [...departments].sort((a, b) => a.pipelineOrder - b.pipelineOrder),
    [departments],
  );

  const currentStage = useMemo(
    () => getCurrentStageInfo(request.transitions, departments),
    [request.transitions, departments],
  );

  const completedCount = useMemo(
    () =>
      sortedDepartments.filter(
        (d) => getStageState(request.transitions, d.id) === 'completed',
      ).length,
    [sortedDepartments, request.transitions],
  );

  const totalDepartments = sortedDepartments.length;

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

  const isCompleted = request.status === 'completed';

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
          <span>{request.carNumber}</span>
        </div>

        {/* Client name */}
        <div className={styles.cardSectionRow}>
          <Phone size={16} className={styles.cardSectionIcon} />
          <span>{request.clientName}</span>
        </div>

        {/* Progress dots */}
        <div className={styles.cardSection}>
          <div className={styles.progressDots}>
            {sortedDepartments.map((dept, index) => {
              const state = getStageState(request.transitions, dept.id);
              const prevState =
                index > 0
                  ? getStageState(
                      request.transitions,
                      sortedDepartments[index - 1].id,
                    )
                  : null;

              let connectorClass = '';
              if (prevState === 'completed') {
                connectorClass = styles.filled;
              } else if (prevState === 'started') {
                connectorClass = styles.current;
              }

              return (
                <div
                  key={dept.id}
                  style={{ display: 'flex', alignItems: 'center', flex: 1 }}
                >
                  {index > 0 && (
                    <div
                      className={`${styles.dotConnector} ${connectorClass}`}
                    />
                  )}
                  <div
                    className={`${styles.dot} ${
                      state === 'completed'
                        ? styles.filled
                        : state === 'started'
                          ? styles.current
                          : styles.empty
                    }`}
                    title={dept.name}
                  />
                </div>
              );
            })}
          </div>
          <span className={styles.progressLabel}>
            {completedCount}/{totalDepartments} stages completed
          </span>
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
