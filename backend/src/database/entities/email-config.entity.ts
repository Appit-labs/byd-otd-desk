import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('email_config')
export class EmailConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'smtp_host', length: 255, nullable: true })
  smtpHost: string;

  @Column({ name: 'smtp_port', default: 587 })
  smtpPort: number;

  @Column({ name: 'smtp_username', length: 255, nullable: true })
  smtpUsername: string;

  @Column({ name: 'smtp_password', length: 255, nullable: true })
  smtpPassword: string;

  @Column({ name: 'from_address', length: 255, nullable: true })
  fromAddress: string;

  @Column({ name: 'from_name', length: 255, nullable: true })
  fromName: string;

  @Column({ name: 'enabled', default: false })
  enabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
