import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';
import { SettingOption } from './setting-option.entity.js';
import { RequestStageTransition } from './request-stage-transition.entity.js';

export enum RequestStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
}

@Entity('car_requests')
export class CarRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_number', length: 50, unique: true })
  requestNumber: string;

  @Column({ name: 'request_type_id' })
  requestTypeId: number;

  @ManyToOne(() => SettingOption)
  @JoinColumn({ name: 'request_type_id' })
  requestType: SettingOption;

  @Column({ name: 'car_number', length: 100 })
  carNumber: string;

  @Column({ name: 'body_number', length: 100, nullable: true })
  bodyNumber: string;

  @Column({ name: 'car_color_id', nullable: true })
  carColorId: number;

  @ManyToOne(() => SettingOption)
  @JoinColumn({ name: 'car_color_id' })
  carColor: SettingOption;

  @Column({ name: 'car_spec_id', nullable: true })
  carSpecId: number;

  @ManyToOne(() => SettingOption)
  @JoinColumn({ name: 'car_spec_id' })
  carSpec: SettingOption;

  @Column({ name: 'client_name', length: 200 })
  clientName: string;

  @Column({ name: 'client_tel', length: 50 })
  clientTel: string;

  @Column({ name: 'payment_method_id' })
  paymentMethodId: number;

  @ManyToOne(() => SettingOption)
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: SettingOption;

  @Column({ name: 'seller_id' })
  sellerId: number;

  @ManyToOne(() => SettingOption)
  @JoinColumn({ name: 'seller_id' })
  seller: SettingOption;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.NOT_STARTED,
  })
  status: RequestStatus;

  @Column({ name: 'created_by' })
  createdBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @OneToMany(() => RequestStageTransition, (transition) => transition.request)
  transitions: RequestStageTransition[];
}
