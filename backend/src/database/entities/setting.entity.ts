import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { SettingOption } from './setting-option.entity.js';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  key: string;

  @Column({ length: 200 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => SettingOption, (option) => option.setting)
  options: SettingOption[];
}
