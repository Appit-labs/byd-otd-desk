import { Injectable, Logger } from '@nestjs/common';
import { SmtpConfigService } from './smtp-config.service.js';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class TransportFactory {
  private readonly logger = new Logger(TransportFactory.name);

  constructor(private readonly smtpConfigService: SmtpConfigService) {}

  async create(): Promise<Transporter> {
    const cfg = await this.smtpConfigService.getActiveConfig();
    const provider = cfg?.provider || 'resend';

    if (provider === 'resend') {
      const apiKey = cfg?.apiKey || process.env.RESEND_API_KEY || process.env.FALLBACK_SMTP_PASS || '';
      this.logger.log(`Using Resend API transport`);
      return createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: apiKey,
        },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      });
    }

    // SMTP provider — use DB config or fallback to env vars
    if (cfg && cfg.smtpHost) {
      this.logger.log(`Using SMTP transport: ${cfg.smtpHost}:${cfg.smtpPort}`);
      return createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort || 587,
        secure: (cfg.smtpPort || 587) === 465,
        auth: {
          user: cfg.smtpUsername || '',
          pass: cfg.smtpPassword || '',
        },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.NODE_ENV === 'production' },
      });
    }

    // Fallback to Resend via env vars
    this.logger.log(`Using fallback Resend transport from env vars`);
    return createTransport({
      host: process.env.FALLBACK_SMTP_HOST || 'smtp.resend.com',
      port: Number(process.env.FALLBACK_SMTP_PORT || 465),
      secure: Number(process.env.FALLBACK_SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.FALLBACK_SMTP_USER || 'resend',
        pass: process.env.FALLBACK_SMTP_PASS || '',
      },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });
  }

  async verify(): Promise<{ ok: boolean; message: string; provider: string }> {
    const transport = await this.create();
    try {
      await transport.verify();
      const cfg = await this.smtpConfigService.getActiveConfig();
      return { ok: true, message: 'Connection verified successfully', provider: cfg?.provider || 'resend' };
    } catch (err) {
      return { ok: false, message: `Connection failed: ${(err as Error).message}`, provider: 'unknown' };
    } finally {
      transport.close();
    }
  }
}
