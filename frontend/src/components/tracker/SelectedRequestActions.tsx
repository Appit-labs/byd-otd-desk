import { useState, useMemo } from 'react';
import { Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { CarRequest } from '@/types/request';
import styles from './tracker.module.css';

interface SelectedRequestActionsProps {
  request: CarRequest;
  onStageAction: (requestId: number, stage: string, action: string) => void;
}

const STAGE_ORDER = [
  'storage',
  'vehicle_received',
  'mechanical_check',
  'pdi',
  'sent_to_accessories',
  'accessories',
  'final_inspection',
  'gps',
  'registration',
  'delivery',
] as const;

type StageSlug = (typeof STAGE_ORDER)[number];

const STAGE_LABEL: Record<StageSlug, string> = {
  storage: 'Storage',
  vehicle_received: 'Vehicle Received',
  mechanical_check: 'Mechanical Check',
  pdi: 'PDI',
  sent_to_accessories: 'Sent to Acc.',
  accessories: 'Accessories',
  final_inspection: 'Final Inspection',
  gps: 'GPS',
  registration: 'Registration',
  delivery: 'Delivery',
};

function isSkipped(req: CarRequest, stage: StageSlug): boolean {
  switch (stage) {
    case 'pdi':
      return req.requestType?.value === 'no_pdi';
    case 'sent_to_accessories':
    case 'accessories':
      return !req.hasAccessories && (!req.accessories || req.accessories.length === 0);
    case 'gps':
      return !req.hasGps;
    default:
      return false;
  }
}

function isDone(req: CarRequest, stage: StageSlug): boolean {
  if (isSkipped(req, stage)) return true;
  switch (stage) {
    case 'storage': return !!req.storageAt;
    case 'vehicle_received': return !!req.vehicleReceivedAt;
    case 'mechanical_check': return !!req.mechanicalCheckCompletedAt;
    case 'pdi': return !!req.pdiCompletedAt;
    case 'sent_to_accessories': return !!req.sentToAccessoriesAt;
    case 'accessories': return !!req.accessoriesCompletedAt;
    case 'final_inspection': return !!req.finalInspectionAt;
    case 'gps': return !!req.gpsConfirmedAt;
    case 'registration': return !!req.registeredAt;
    case 'delivery': return !!req.deliveredAt;
    default: return false;
  }
}

function isStarted(req: CarRequest, stage: StageSlug): boolean {
  switch (stage) {
    case 'mechanical_check': return !!req.mechanicalCheckStartedAt;
    case 'pdi': return !!req.pdiStartedAt;
    case 'accessories': return !!req.accessoriesStartedAt;
    default: return false;
  }
}

function getNextStageAction(req: CarRequest): { stage: StageSlug; action: string } | null {
  if (req.status !== 'active') {
    return null;
  }

  for (const stage of STAGE_ORDER) {
    if (isSkipped(req, stage)) continue;
    if (isDone(req, stage)) continue;

    if (isStarted(req, stage)) {
      return { stage, action: 'complete' };
    }

    // First non-done, non-started stage
    switch (stage) {
      case 'storage':
      case 'vehicle_received':
      case 'sent_to_accessories':
      case 'gps':
      case 'registration':
        return { stage, action: 'confirm' };
      case 'mechanical_check':
      case 'pdi':
      case 'accessories':
        return { stage, action: 'start' };
      case 'delivery':
        return { stage, action: 'confirm' };
      case 'final_inspection':
        return { stage, action: 'open_modal' };
    }
  }

  return null; // All done
}

export function SelectedRequestActions({
  request,
  onStageAction,
}: SelectedRequestActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nextAction = useMemo(() => getNextStageAction(request), [request]);

  if (request.status === 'archived_qc' || request.status === 'archived_manual') {
    return (
      <div className={styles.actionToolbar}>
        <span className={styles.actionToolbarTitle}>
          {request.requestNumber} — ✓ Completed
        </span>
        <div className={styles.actionToolbarProgress}>
          {STAGE_ORDER.map((stage) => {
            const skipped = isSkipped(request, stage);
            const done = isDone(request, stage);
            return (
              <span
                key={stage}
                className={`${styles.progressDot} ${
                  done ? styles.progressDotDone : skipped ? styles.progressDotEmpty : styles.progressDotEmpty
                }`}
                title={`${STAGE_LABEL[stage]}: ${skipped ? 'N/A' : done ? 'Done' : '—'}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (request.status === 'cancelled') {
    return (
      <div className={styles.actionToolbar}>
        <span className={styles.actionToolbarTitle}>
          {request.requestNumber} — ✕ Cancelled
        </span>
      </div>
    );
  }

  if (!nextAction || request.status !== 'active') {
    return (
      <div className={styles.actionToolbar}>
        <span className={styles.actionToolbarTitle}>
          {request.requestNumber} — {request.customerName}
        </span>
        <div className={styles.actionToolbarProgress}>
          {STAGE_ORDER.map((stage) => {
            const skipped = isSkipped(request, stage);
            const done = isDone(request, stage);
            const started = isStarted(request, stage);
            return (
              <span
                key={stage}
                className={`${styles.progressDot} ${
                  done ? styles.progressDotDone : started ? styles.progressDotActive : skipped ? styles.progressDotEmpty : styles.progressDotEmpty
                }`}
                title={`${STAGE_LABEL[stage]}: ${skipped ? 'N/A' : done ? 'Done' : started ? 'In Progress' : '—'}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const stageLabel = STAGE_LABEL[nextAction.stage];
  const actionVerb = nextAction.action === 'start' ? 'Start' : nextAction.action === 'complete' ? 'Complete' : nextAction.action === 'open_modal' ? 'Open' : 'Confirm';
  const actionLabel = `${actionVerb} — ${stageLabel}`;

  const handleConfirm = () => {
    onStageAction(request.id, nextAction.stage, nextAction.action);
    setConfirmOpen(false);
  };

  return (
    <>
      <div className={styles.actionToolbar}>
        <span className={styles.actionToolbarTitle}>
          {request.requestNumber} — {request.customerName}
        </span>
        <div className={styles.actionToolbarProgress}>
          {STAGE_ORDER.map((stage) => {
            const skipped = isSkipped(request, stage);
            const done = isDone(request, stage);
            const started = isStarted(request, stage);
            return (
              <span
                key={stage}
                className={`${styles.progressDot} ${
                  done ? styles.progressDotDone : started ? styles.progressDotActive : skipped ? styles.progressDotEmpty : styles.progressDotEmpty
                }`}
                title={`${STAGE_LABEL[stage]}: ${skipped ? 'N/A' : done ? 'Done' : started ? 'In Progress' : '—'}`}
              />
            );
          })}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          {nextAction.action === 'start' ? (
            <Play size={14} />
          ) : (
            <Check size={14} />
          )}
          {actionLabel}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Action"
      >
        <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
          {actionLabel} for {request.requestNumber} ({request.customerName})?
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
}
