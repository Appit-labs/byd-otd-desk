import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { User } from './user.entity.js';
import type { SettingOption } from './setting-option.entity.js';
import type { RequestStageTransition } from './request-stage-transition.entity.js';

/**
 * Request lifecycle status.
 *
 * active          – request is in-progress; stage actions are allowed
 * cancelled       – permanently terminal; no further actions, no re-opening
 * archived_manual – manually archived by Admin/Super Admin; can be re-activated
 * archived_qc     – archived via Final Inspection by QC NVS; only re-openable
 *                    by QC NVS or Super Admin re-submitting Final Inspection
 */
export enum RequestStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  ARCHIVED_MANUAL = 'archived_manual',
  ARCHIVED_QC = 'archived_qc',
}

/**
 * Pipeline stage identifiers — used by the stage resolver and stage-action
 * endpoints to determine which stage a request is currently at.
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

@Entity('car_requests')
export class CarRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_number', length: 50, unique: true })
  requestNumber: string;

  @Column({ name: 'request_type_id' })
  requestTypeId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'request_type_id' })
  requestType: SettingOption;

  @Column({ name: 'chassis_number', length: 100 })
  chassisNumber: string;

  @Column({ name: 'brand_id', nullable: true })
  brandId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'brand_id' })
  brand: SettingOption;

  @Column({ name: 'model_id', nullable: true })
  modelId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'model_id' })
  model: SettingOption;

  @Column({ name: 'variant_id', nullable: true })
  variantId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'variant_id' })
  variant: SettingOption;

  @Column({ name: 'exterior_color_id', nullable: true })
  exteriorColorId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'exterior_color_id' })
  exteriorColor: SettingOption;

  @Column({ name: 'interior_color_id', nullable: true })
  interiorColorId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'interior_color_id' })
  interiorColor: SettingOption;

  @Column({ name: 'vehicle_location', length: 200, nullable: true })
  vehicleLocation: string;

  @Column({ name: 'showroom_id', nullable: true })
  showroomId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'showroom_id' })
  showroom: SettingOption;

  @Column({ name: 'customer_name', length: 200 })
  customerName: string;

  @Column({ name: 'customer_phone', length: 50 })
  customerPhone: string;

  @Column({ name: 'sales_consultant_id' })
  salesConsultantId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'sales_consultant_id' })
  salesConsultant: SettingOption;

  @Column({ name: 'sales_type_id', nullable: true })
  salesTypeId: number;

  @ManyToOne('SettingOption')
  @JoinColumn({ name: 'sales_type_id' })
  salesType: SettingOption;

  @Column({ type: 'json', nullable: true })
  accessories: number[];

  @Column({ name: 'has_gps', default: false })
  hasGps: boolean;

  @Column({ name: 'has_accessories', default: false })
  hasAccessories: boolean;

  @Column({ name: 'promise_date', nullable: true })
  promiseDate: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // ── Pipeline timestamps ──

  @Column({ name: 'storage_at', type: 'datetime', nullable: true })
  storageAt: Date;

  @Column({ name: 'vehicle_received_at', type: 'datetime', nullable: true })
  vehicleReceivedAt: Date;

  @Column({ name: 'mechanical_check_started_at', type: 'datetime', nullable: true })
  mechanicalCheckStartedAt: Date;

  @Column({ name: 'mechanical_check_completed_at', type: 'datetime', nullable: true })
  mechanicalCheckCompletedAt: Date;

  @Column({ name: 'mechanical_check_remarks', type: 'text', nullable: true })
  mechanicalCheckRemarks: string;

  @Column({ name: 'pdi_started_at', type: 'datetime', nullable: true })
  pdiStartedAt: Date;

  @Column({ name: 'pdi_completed_at', type: 'datetime', nullable: true })
  pdiCompletedAt: Date;

  @Column({ name: 'pdi_remarks', type: 'text', nullable: true })
  pdiRemarks: string;

  @Column({ name: 'sent_to_accessories_at', type: 'datetime', nullable: true })
  sentToAccessoriesAt: Date;

  @Column({ name: 'accessories_started_at', type: 'datetime', nullable: true })
  accessoriesStartedAt: Date;

  @Column({ name: 'accessories_completed_at', type: 'datetime', nullable: true })
  accessoriesCompletedAt: Date;

  @Column({ name: 'accessories_remarks', type: 'text', nullable: true })
  accessoriesRemarks: string;

  @Column({ name: 'final_inspection_at', type: 'datetime', nullable: true })
  finalInspectionAt: Date;

  @Column({ name: 'gps_confirmed_at', type: 'datetime', nullable: true })
  gpsConfirmedAt: Date;

  @Column({ name: 'registered_at', type: 'datetime', nullable: true })
  registeredAt: Date;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date;

  // ── Computed duration fields (in seconds) ──

  @Column({ name: 'mechanical_check_duration', type: 'int', nullable: true })
  mechanicalCheckDuration: number;

  @Column({ name: 'pdi_duration', type: 'int', nullable: true })
  pdiDuration: number;

  @Column({ name: 'accessories_duration', type: 'int', nullable: true })
  accessoriesDuration: number;

  // ── Final Inspection ──

  @Column({ name: 'final_inspection_outcome', length: 100, nullable: true })
  finalInspectionOutcome: string;

  @Column({ name: 'final_inspection_remarks', type: 'text', nullable: true })
  finalInspectionRemarks: string;

  // ── Delivery ──

  @Column({ name: 'delivery_remarks', type: 'text', nullable: true })
  deliveryRemarks: string;

  // ── Lifecycle status ──

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.ACTIVE,
  })
  status: RequestStatus;

  // ── Audit ──

  @Column({ name: 'created_by' })
  createdBy: number;

  @ManyToOne('User')
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @OneToMany('RequestStageTransition', (transition: any) => transition.request)
  transitions: RequestStageTransition[];
}
