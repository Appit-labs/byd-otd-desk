import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailConfig } from '../database/entities/email-config.entity.js';
import { createDecipheriv, createCipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class SmtpConfigService {
  private readonly logger = new Logger(SmtpConfigService.name);
  private cachedConfig: EmailConfig | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 60_000;

  // AES-256-CBC key derived from APP_SECRET env var
  private readonly encKey: Buffer = scryptSync(
    process.env.APP_SECRET ?? 'changeme-set-APP_SECRET-in-env',
    'byd-otd-email-salt',
    32,
  );

  constructor(
    @InjectRepository(EmailConfig)
    private readonly repo: Repository<EmailConfig>,
  ) {}

  async getActiveConfig(): Promise<EmailConfig> {
    const now = Date.now();
    if (this.cachedConfig && now < this.cacheExpiry) {
      return this.cachedConfig;
    }
    const config = await this.repo.findOne({ where: {} });
    if (!config || !config.smtpHost) {
      // Return null-config — caller will use fallback env vars
      this.logger.warn('No active SMTP configuration in DB, will use fallback env vars');
      return config ?? ({} as EmailConfig);
    }
    if (config.smtpPassword) {
      try {
        config.smtpPassword = this.decrypt(config.smtpPassword);
      } catch {
        // Password may not be encrypted yet (existing plaintext)
        this.logger.debug('SMTP password is not encrypted — will encrypt on next save');
      }
    }
    this.cachedConfig = config;
    this.cacheExpiry = now + this.CACHE_TTL_MS;
    return config;
  }

  /** Call after admin updates config to bust cache immediately */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.cacheExpiry = 0;
    this.logger.log('SMTP config cache invalidated');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, dataHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.encKey, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
