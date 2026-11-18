import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

export type EmailProvider = 'resend' | 'smtp';

@Entity('email_config')
export class EmailConfig {
  @PrimaryGeneratedColumn()
  id: number;

  /** Provider: 'resend' (API) or 'smtp' */
  @Column({ length: 20, default: 'resend' })
  provider: EmailProvider;

  /** Resend API key (used when provider = 'resend') */
  @Column({ name: 'api_key', length: 255, nullable: true })
  apiKey: string;

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
