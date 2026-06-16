export interface SettingOption {
  id: number;
  label: string;
  value: string;
}

export interface Department {
  id: number;
  name: string;
  slug: string;
  pipelineOrder: number;
}

export interface StageDepartment {
  id: number;
  name: string;
  slug: string;
  pipelineOrder: number;
}

export interface ActionedBy {
  id: number;
  fullName: string;
}

export interface RequestStageTransition {
  id: number;
  requestId: number;
  departmentId: number;
  department: StageDepartment;
  action: 'started' | 'completed';
  actionedBy: ActionedBy;
  actionedAt: string;
}

/**
 * Pipeline stage number identifiers (matching backend PipelineStage enum).
 */
export enum PipelineStage {
  CREATED = 1,
  STORAGE = 2,
  SHOWROOM = 3,
  MECHANICAL_CHECK = 4,
  PDI = 5,
  SENT_TO_ACCESSORIES = 6,
  ACCESSORIES = 7,
  FINAL_INSPECTION = 8,
  GPS = 9,
  REGISTRATION = 10,
  DELIVERY = 11,
}

export const PIPELINE_STAGE_NAMES: Record<PipelineStage, string> = {
  [PipelineStage.CREATED]: 'Created',
  [PipelineStage.STORAGE]: 'Storage',
  [PipelineStage.SHOWROOM]: 'Showroom',
  [PipelineStage.MECHANICAL_CHECK]: 'Mechanical Check',
  [PipelineStage.PDI]: 'PDI',
  [PipelineStage.SENT_TO_ACCESSORIES]: 'Sent to Accessories',
  [PipelineStage.ACCESSORIES]: 'Accessories',
  [PipelineStage.FINAL_INSPECTION]: 'Final Inspection',
  [PipelineStage.GPS]: 'GPS',
  [PipelineStage.REGISTRATION]: 'Registration',
  [PipelineStage.DELIVERY]: 'Delivery',
};

export type RequestStatus = 'active' | 'cancelled' | 'archived_manual' | 'archived_qc';

export interface CarRequest {
  id: number;
  requestNumber: string;
  requestType: SettingOption;
  chassisNumber: string;
  brand?: SettingOption | null;
  model?: SettingOption | null;
  variant?: SettingOption | null;
  exteriorColor?: SettingOption | null;
  interiorColor?: SettingOption | null;
  vehicleLocation?: string | null;
  showroom?: SettingOption | null;
  customerName: string;
  customerPhone: string;
  salesConsultant: SettingOption;
  salesType?: SettingOption | null;
  accessories?: number[] | null;
  hasGps: boolean;
  promiseDate?: string | null;
  remarks?: string;
  status: RequestStatus;

  // Pipeline timestamps
  storageAt?: string | null;
  vehicleReceivedAt?: string | null;
  mechanicalCheckStartedAt?: string | null;
  mechanicalCheckCompletedAt?: string | null;
  mechanicalCheckDuration?: number | null;
  pdiStartedAt?: string | null;
  pdiCompletedAt?: string | null;
  pdiDuration?: number | null;
  sentToAccessoriesAt?: string | null;
  accessoriesStartedAt?: string | null;
  accessoriesCompletedAt?: string | null;
  accessoriesDuration?: number | null;
  finalInspectionAt?: string | null;
  finalInspectionOutcome?: string | null;
  finalInspectionRemarks?: string | null;
  gpsConfirmedAt?: string | null;
  registeredAt?: string | null;
  deliveredAt?: string | null;
  deliveryRemarks?: string | null;

  // Audit
  createdBy: { id: number; fullName: string };
  createdAt: string;
  completedAt?: string;
  transitions: RequestStageTransition[];

  // Computed by backend
  isDelayed: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  metadata?: PaginationMeta;
}
