import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { CarRequest } from '@/types/request';
import { PipelineStage } from '@/types/request';

/**
 * Determine the current pipeline stage for a request based on filled timestamps.
 * Returns the first stage whose completion field is null/undefined.
 * Returns null if all stages are complete (delivered).
 */
export function resolveCurrentStage(request: CarRequest): PipelineStage | null {
  const checks: { stage: PipelineStage; done: boolean }[] = [
    { stage: PipelineStage.CREATED, done: true }, // always done if request exists
    { stage: PipelineStage.STORAGE, done: !!request.storageAt },
    { stage: PipelineStage.SHOWROOM, done: !!request.vehicleReceivedAt },
    { stage: PipelineStage.MECHANICAL_CHECK, done: !!request.mechanicalCheckCompletedAt },
    { stage: PipelineStage.PDI, done: !!request.pdiCompletedAt },
    { stage: PipelineStage.SENT_TO_ACCESSORIES, done: !!request.sentToAccessoriesAt },
    { stage: PipelineStage.ACCESSORIES, done: !!request.accessoriesCompletedAt },
    { stage: PipelineStage.FINAL_INSPECTION, done: !!request.finalInspectionAt },
    { stage: PipelineStage.GPS, done: !!request.gpsConfirmedAt },
    { stage: PipelineStage.REGISTRATION, done: !!request.registeredAt },
    { stage: PipelineStage.DELIVERY, done: !!request.deliveredAt },
  ];

  // Filter out conditional stages that don't apply
  const requestTypeVal = request.requestType?.value;
  const hasPdi = requestTypeVal === 'pdi';
  const hasAccessories = request.hasAccessories === true
    || (!!request.accessories && request.accessories.length > 0);
  const hasGps = request.hasGps === true;

  const applicableChecks = checks.filter((c) => {
    if (c.stage === PipelineStage.PDI) return hasPdi;
    if (
      c.stage === PipelineStage.SENT_TO_ACCESSORIES ||
      c.stage === PipelineStage.ACCESSORIES
    )
      return hasAccessories;
    if (c.stage === PipelineStage.GPS) return hasGps;
    return true;
  });

  for (const check of applicableChecks) {
    if (!check.done) return check.stage;
  }

  return null; // All done
}

/** Role-to-stage mapping (must stay in sync with backend) */
const ROLE_STAGE_MAP: Record<string, PipelineStage[]> = {
  super_admin: [
    PipelineStage.STORAGE,
    PipelineStage.SHOWROOM,
    PipelineStage.MECHANICAL_CHECK,
    PipelineStage.PDI,
    PipelineStage.SENT_TO_ACCESSORIES,
    PipelineStage.ACCESSORIES,
    PipelineStage.FINAL_INSPECTION,
    PipelineStage.GPS,
    PipelineStage.REGISTRATION,
    PipelineStage.DELIVERY,
  ],
  admin: [], // admin cannot perform stage actions
  nvs: [PipelineStage.STORAGE],
  qc_nvs: [
    PipelineStage.SHOWROOM,
    PipelineStage.SENT_TO_ACCESSORIES,
    PipelineStage.FINAL_INSPECTION,
  ],
  mechanical_check: [PipelineStage.MECHANICAL_CHECK, PipelineStage.GPS],
  pdi: [PipelineStage.PDI],
  accessories: [PipelineStage.ACCESSORIES],
  registration: [PipelineStage.REGISTRATION],
  delivery: [PipelineStage.DELIVERY],
  viewer: [],
};

/**
 * Get the action that the current user can perform on this request.
 * Returns the stage + action type, or null if no action is available.
 */
export function getAvailableAction(
  request: CarRequest,
  userRole: string,
): {
  stage: PipelineStage;
  action: 'start' | 'complete' | 'confirm';
  label: string;
} | null {
  if (request.status !== 'active') return null;

  const currentStage = resolveCurrentStage(request);
  if (!currentStage) return null;

  const allowedStages = ROLE_STAGE_MAP[userRole.toLowerCase()] ?? [];
  if (!allowedStages.includes(currentStage)) return null;

  // Determine action type based on stage
  switch (currentStage) {
    case PipelineStage.STORAGE:
      return { stage: currentStage, action: 'confirm', label: 'Dispatch Vehicle' };
    case PipelineStage.SHOWROOM:
      return { stage: currentStage, action: 'confirm', label: 'Confirm Vehicle Received' };
    case PipelineStage.MECHANICAL_CHECK: {
      // Check if already started
      if (!request.mechanicalCheckStartedAt) {
        return { stage: currentStage, action: 'start', label: 'Start Mechanical Check' };
      }
      return { stage: currentStage, action: 'complete', label: 'Complete Mechanical Check' };
    }
    case PipelineStage.PDI: {
      if (!request.pdiStartedAt) {
        return { stage: currentStage, action: 'start', label: 'Start PDI' };
      }
      return { stage: currentStage, action: 'complete', label: 'Complete PDI' };
    }
    case PipelineStage.SENT_TO_ACCESSORIES:
      return { stage: currentStage, action: 'confirm', label: 'Confirm Sent to Accessories' };
    case PipelineStage.ACCESSORIES: {
      if (!request.accessoriesStartedAt) {
        return { stage: currentStage, action: 'start', label: 'Start Accessories' };
      }
      return { stage: currentStage, action: 'complete', label: 'Complete Accessories' };
    }
    case PipelineStage.FINAL_INSPECTION:
      return { stage: currentStage, action: 'confirm', label: 'Final Inspection' };
    case PipelineStage.GPS:
      return { stage: currentStage, action: 'confirm', label: 'Confirm GPS Done' };
    case PipelineStage.REGISTRATION:
      return { stage: currentStage, action: 'confirm', label: 'Register Vehicle' };
    case PipelineStage.DELIVERY:
      return { stage: currentStage, action: 'confirm', label: 'Confirm Delivery' };
    default:
      return null;
  }
}

interface StageActionParams {
  requestId: number;
  stage: PipelineStage;
  action: 'start' | 'complete' | 'confirm';
  /** Optional payload for complete/confirm actions */
  payload?: Record<string, unknown>;
}

export function useStageActions() {
  const queryClient = useQueryClient();

  const mutation = useMutation<unknown, Error, StageActionParams>({
    mutationFn: async ({ requestId, stage, action }) => {
      const endpoint = getStageEndpoint(stage, action);
      await api.post(`/v1/requests/${requestId}/${endpoint}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  return {
    executeAction: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

function getStageEndpoint(stage: PipelineStage, action: 'start' | 'complete' | 'confirm'): string {
  switch (stage) {
    case PipelineStage.STORAGE:
      return 'dispatch-vehicle';
    case PipelineStage.SHOWROOM:
      return 'vehicle-received';
    case PipelineStage.MECHANICAL_CHECK:
      return action === 'start' ? 'mechanical-check/start' : 'mechanical-check/complete';
    case PipelineStage.PDI:
      return action === 'start' ? 'pdi/start' : 'pdi/complete';
    case PipelineStage.SENT_TO_ACCESSORIES:
      return 'confirm-sent-to-accessories';
    case PipelineStage.ACCESSORIES:
      return action === 'start' ? 'accessories/start' : 'accessories/complete';
    case PipelineStage.FINAL_INSPECTION:
      return 'final-inspection';
    case PipelineStage.GPS:
      return 'confirm-gps-done';
    case PipelineStage.REGISTRATION:
      return 'register';
    case PipelineStage.DELIVERY:
      return 'confirm-delivery';
    default:
      return 'transition';
  }
}

/** Cancel a request (Admin/Super Admin only) */
export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) =>
      api.post(`/v1/requests/${requestId}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });
}

/** Archive a request (Admin/Super Admin only) */
export function useArchiveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) =>
      api.post(`/v1/requests/${requestId}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });
}

/** Reactivate an archived request */
export function useReactivateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      resetDates,
    }: {
      requestId: number;
      resetDates: boolean;
    }) =>
      api.post(`/v1/requests/${requestId}/reactivate`, {
        resetDates,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });
}
