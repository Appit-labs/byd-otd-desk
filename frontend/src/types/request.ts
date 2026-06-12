export interface RequestType {
  id: number;
  label: string;
  value: string;
}

export interface CarColor {
  id: number;
  label: string;
  value: string;
}

export interface CarSpec {
  id: number;
  label: string;
  value: string;
}

export interface PaymentMethod {
  id: number;
  label: string;
  value: string;
}

export interface Seller {
  id: number;
  fullName: string;
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

export type RequestStatus = 'not_started' | 'pending' | 'on_hold' | 'completed';

export interface CarRequest {
  id: number;
  requestNumber: string;
  requestType: RequestType;
  carNumber: string;
  bodyNumber?: string;
  carColor?: CarColor;
  carSpec?: CarSpec;
  clientName: string;
  clientTel: string;
  paymentMethod: PaymentMethod;
  seller: Seller;
  remarks?: string;
  status: RequestStatus;
  createdBy: { id: number; fullName: string };
  createdAt: string;
  completedAt?: string;
  transitions: RequestStageTransition[];
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
