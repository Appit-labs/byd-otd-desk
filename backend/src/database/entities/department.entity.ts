import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity.js';
import { RequestStageTransition } from './request-stage-transition.entity.js';

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

  @OneToMany(() => User, (user) => user.department)
  users: User[];

  @OneToMany(() => RequestStageTransition, (t) => t.department)
  stageTransitions: RequestStageTransition[];
}
