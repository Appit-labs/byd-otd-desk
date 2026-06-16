import { Injectable } from '@nestjs/common';
import { SmtpConfigService } from './smtp-config.service.js';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class TransportFactory {
  constructor(private readonly smtpConfigService: SmtpConfigService) {}

  async create(): Promise<Transporter> {
    const cfg = await this.smtpConfigService.getActiveConfig();

    // If DB config exists and has host, use it
    if (cfg && cfg.smtpHost) {
      return createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort || 587,
        secure: (cfg.smtpPort || 587) === 465,
        auth: {
          user: cfg.smtpUsername || '',
          pass: cfg.smtpPassword || '',
        },
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });
    }

    // Fallback to environment variables
    return createTransport({
      host: process.env.FALLBACK_SMTP_HOST || 'smtp.resend.com',
      port: Number(process.env.FALLBACK_SMTP_PORT || 465),
      secure: Number(process.env.FALLBACK_SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.FALLBACK_SMTP_USER || 'resend',
        pass: process.env.FALLBACK_SMTP_PASS || '',
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  async verify(): Promise<boolean> {
    const transport = await this.create();
    try {
      await transport.verify();
      return true;
    } finally {
      transport.close();
    }
  }
}
