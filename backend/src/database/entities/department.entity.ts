import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import type { User } from './user.entity.js';
import type { RequestStageTransition } from './request-stage-transition.entity.js';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ name: 'pipeline_order' })
  pipelineOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany('User', (user: any) => user.department)
  users: User[];

  @OneToMany('RequestStageTransition', (t: any) => t.department)
  stageTransitions: RequestStageTransition[];
}
