import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { Setting } from './setting.entity.js';

@Entity('setting_options')
export class SettingOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'setting_id' })
  settingId: number;

  @ManyToOne('Setting', (setting: any) => setting.options)
  @JoinColumn({ name: 'setting_id' })
  setting: Setting;

  @Column({ name: 'parent_id', nullable: true, type: 'int' })
  parentId: number | null;

  @ManyToOne('SettingOption', { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: SettingOption;

  @OneToMany('SettingOption', (option: any) => option.parent)
  children: SettingOption[];

  @Column({ length: 200 })
  label: string;

  @Column({ length: 100 })
  value: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
