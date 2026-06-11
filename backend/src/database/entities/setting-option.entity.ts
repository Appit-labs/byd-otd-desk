import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Setting } from './setting.entity.js';

@Entity('setting_options')
export class SettingOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'setting_id' })
  settingId: number;

  @ManyToOne(() => Setting, (setting) => setting.options)
  @JoinColumn({ name: 'setting_id' })
  setting: Setting;

  @Column({ length: 200 })
  label: string;

  @Column({ length: 100 })
  value: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
