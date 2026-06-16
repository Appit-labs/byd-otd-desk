import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { CarRequest } from './car-request.entity.js';

@Entity('notification_log')
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_id', nullable: true })
  requestId: number;

  @ManyToOne('CarRequest', { nullable: true })
  @JoinColumn({ name: 'request_id' })
  request: CarRequest;

  @Column({ length: 100 })
  event: string;

  @Column({ type: 'text' })
  recipients: string;

  @Column({ name: 'subject', length: 255 })
  subject: string;

  @Column({ length: 20, default: 'sent' })
  status: string; // 'sent' | 'failed'

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
