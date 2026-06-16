import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { CarRequest } from './car-request.entity.js';
import type { Department } from './department.entity.js';
import type { User } from './user.entity.js';

export enum TransitionAction {
  STARTED = 'started',
  COMPLETED = 'completed',
}

@Entity('request_stage_transitions')
@Unique('uq_request_dept_action', ['requestId', 'departmentId', 'action'])
export class RequestStageTransition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_id' })
  requestId: number;

  @ManyToOne('CarRequest')
  @JoinColumn({ name: 'request_id' })
  request: CarRequest;

  @Column({ name: 'department_id' })
  departmentId: number;

  @ManyToOne('Department')
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'enum', enum: TransitionAction })
  action: TransitionAction;

  @Column({ name: 'actioned_by' })
  actionedBy: number;

  @ManyToOne('User')
  @JoinColumn({ name: 'actioned_by' })
  actionedByUser: User;

  @CreateDateColumn({ name: 'actioned_at' })
  actionedAt: Date;
}
