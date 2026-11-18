import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailConfig, type EmailProvider } from '../database/entities/email-config.entity.js';
import { NotificationLog } from '../database/entities/notification-log.entity.js';
import { User } from '../database/entities/user.entity.js';
import { CarRequest } from '../database/entities/car-request.entity.js';
import type { UpdateEmailConfigDto } from './dto/update-email-config.dto.js';
import { SmtpConfigService } from './smtp-config.service.js';
import { TransportFactory } from './transport.factory.js';
import {
  LEGACY_EVENT_MAP,
  NOTIFICATION_EVENTS,
  type NotificationPayload,
} from './notification.events.js';

// ---------------------------------------------------------------------------
//  Public interface for the new send() method
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: string;       // Handlebars template name (without .hbs)
  context: Record<string, unknown>;
  requestId?: number;
  event?: string;
}

// ---------------------------------------------------------------------------
//  Service
// ---------------------------------------------------------------------------

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(EmailConfig)
    private readonly emailConfigRepo: Repository<EmailConfig>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CarRequest)
    private readonly requestsRepo: Repository<CarRequest>,
    private readonly mailerService: MailerService,
    private readonly smtpConfigService: SmtpConfigService,
    private readonly transportFactory: TransportFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  //  Config Management (kept exactly as before)
  // ─────────────────────────────────────────────────────────────────

  async getConfig(): Promise<Partial<EmailConfig> & { smtpPassword?: string; apiKey?: string }> {
    let config = await this.emailConfigRepo.findOne({ where: {} });

    if (!config) {
      config = this.emailConfigRepo.create({
        provider: 'resend',
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        apiKey: process.env.RESEND_API_KEY || process.env.FALLBACK_SMTP_PASS || '',
        fromAddress: '',
        fromName: 'OTD BYD Tracker',
        enabled: false,
      });
      config = await this.emailConfigRepo.save(config);
    }

    // Ensure legacy rows have a provider value
    if (!config.provider) {
      config.provider = 'resend';
      await this.emailConfigRepo.save(config);
    }

    const masked = {
      ...config,
      provider: config.provider ?? 'resend',
      smtpPassword: config.smtpPassword ? '********' : '',
      apiKey: config.apiKey ? '********' : '',
    };
    return masked;
  }

  async updateConfig(data: UpdateEmailConfigDto): Promise<EmailConfig> {
    let config = await this.emailConfigRepo.findOne({ where: {} });

    if (!config) {
      config = this.emailConfigRepo.create();
    }

    if (data.provider !== undefined) config.provider = data.provider as EmailProvider;
    if (data.api_key !== undefined && data.api_key !== '********') config.apiKey = data.api_key;
    if (data.smtp_host !== undefined) config.smtpHost = data.smtp_host;
    if (data.smtp_port !== undefined) config.smtpPort = data.smtp_port;
    if (data.smtp_username !== undefined) config.smtpUsername = data.smtp_username;
    if (data.smtp_password !== undefined && data.smtp_password !== '********') config.smtpPassword = data.smtp_password;
    if (data.from_address !== undefined) config.fromAddress = data.from_address;
    if (data.from_name !== undefined) config.fromName = data.from_name;
    if (data.enabled !== undefined) config.enabled = data.enabled;

    const saved = await this.emailConfigRepo.save(config);
    return saved;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Test Email (uses Handlebars test-email template)
  // ─────────────────────────────────────────────────────────────────

  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
    const config = await this.smtpConfigService.getActiveConfig();

    if (!config || !config.enabled) {
      throw new BadRequestException('Email is not configured or not enabled');
    }

    if (!toEmail) {
      throw new BadRequestException('User email not found');
    }

    try {
      // Use TransportFactory so live DB config is picked up (not stale module-level transport)
      const transport = await this.transportFactory.create();
      try {
        const fromAddress = config.fromAddress || process.env.FALLBACK_FROM_ADDRESS || 'onboarding@resend.dev';
        const fromName = config.fromName || process.env.FALLBACK_FROM_NAME || 'BYD OTD Tracker';
        await transport.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: toEmail,
          subject: 'OTD BYD Tracker — Test Email',
          html: `<p>This is a test email from your BYD OTD Tracker notification system.</p><p>Sent at: ${new Date().toISOString()}</p><p>Provider: ${config.provider || 'resend'}</p>`,
        });
      } finally {
        transport.close();
      }

      this.logger.log(`Test email sent to ${toEmail}`);
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      this.logger.error(`Test email failed: ${error}`);
      throw new BadRequestException(`Failed to send test email: ${(error as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  SMTP connection verification
  // ─────────────────────────────────────────────────────────────────

  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const transport = await this.transportFactory.create();
      await transport.verify();
      transport.close();
      return { ok: true, message: 'SMTP connection successful' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Notification Log (paginated)
  // ─────────────────────────────────────────────────────────────────

  async getNotificationLog(page: number, limit: number, status?: string): Promise<{ data: NotificationLog[]; total: number }> {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.notificationLogRepo.findAndCount({
      where,
      order: { sentAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Role-based Notification (backward-compatible shim → EventEmitter2)
  //  These keep the same public signature so requests.service.ts
  //  continues to work, but internally emit events that the
  //  NotificationListener picks up.
  // ─────────────────────────────────────────────────────────────────

  /**
   * Fire-and-forget notification to all active users with the given role.
   * Now emits an EventEmitter2 event instead of sending directly.
   */
  notifyRole(role: string, event: string, request: CarRequest): void {
    this.notifyRoles([role], event, request);
  }

  /**
   * Send notification to users matching any of the given roles.
   * Now emits an EventEmitter2 event instead of sending directly.
   */
  notifyRoles(roles: string[], event: string, request: CarRequest): void {
    const newEvent = LEGACY_EVENT_MAP[event];
    if (!newEvent) {
      this.logger.warn(`Unknown legacy event "${event}" — cannot emit notification`);
      return;
    }

    // Always include admin for visibility unless already in the list
    const allRoles = [...roles];
    if (!allRoles.includes('admin')) allRoles.push('admin');

    const currentStage = this.resolveStageLabel(request);

    const payload: NotificationPayload = {
      requestId: request.id,
      request: {
        chassisNumber: request.chassisNumber,
        brand: (request as any).brand?.label ?? '',
        model: (request as any).model?.label ?? '',
        variant: (request as any).variant?.label ?? undefined,
        customerName: request.customerName,
        requestType: (request as any).requestType?.label ?? '',
        promiseDate: request.promiseDate?.toISOString() ?? undefined,
        currentStage,
        hasGps: request.hasGps,
        hasAccessories: Array.isArray(request.accessories) && request.accessories.length > 0,
      },
    };

    this.eventEmitter.emitAsync(newEvent, payload).catch((err) => {
      this.logger.error(`Event emission failed for ${newEvent}: ${(err as Error).message}`);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  New send() method — MailerService + Handlebars + retry + logging
  // ─────────────────────────────────────────────────────────────────

  /**
   * Send an email via MailerService with Handlebars template rendering.
   *
   * - Checks global enable flag via SmtpConfigService
   * - Creates a pending/failed notification log entry
   * - Retries up to 2 times (3 total attempts) with 1s / 2s backoff
   * - Never throws — email failures are logged locally
   */
  async send(options: SendEmailOptions): Promise<void> {
    const config = await this.smtpConfigService.getActiveConfig();

    // Respect global enable flag
    if (config && !config.enabled) {
      this.logger.warn(`Email sending disabled by config — skipping "${options.subject}"`);
      return;
    }

    const to = Array.isArray(options.to) ? options.to : [options.to];
    const maxAttempts = 3;
    let lastError: Error | null = null;

    const fromAddress = config?.fromAddress || process.env.FALLBACK_FROM_ADDRESS || 'onboarding@resend.dev';
    const fromName = config?.fromName || process.env.FALLBACK_FROM_NAME || 'BYD OTD Tracker';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const transport = await this.transportFactory.create();
        try {
          await transport.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            to: to.join(', '),
            subject: options.subject,
            html: this.renderEmailHtml(options.context),
          });
        } finally {
          transport.close();
        }

        // — success: log & return
        this.logger.log(`Email sent to ${to.join(', ')} — subject: "${options.subject}"`);

        await this.logNotification({
          requestId: options.requestId,
          event: options.event,
          recipients: to.join(', '),
          subject: options.subject,
          status: 'sent',
        });

        return;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(
          `Email attempt ${attempt}/${maxAttempts} failed for "${options.subject}": ${lastError.message}`,
        );

        if (attempt < maxAttempts) {
          // Backoff: 1s, 2s
          await this.sleep(attempt * 1000);
        }
      }
    }

    // All attempts exhausted — log failure
    this.logger.error(
      `Email failed after ${maxAttempts} attempts to ${to.join(', ')} — subject: "${options.subject}": ${lastError!.message}`,
    );

    await this.logNotification({
      requestId: options.requestId,
      event: options.event,
      recipients: to.join(', '),
      subject: options.subject,
      status: 'failed',
      error: lastError!.message,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────────────────

  private async logNotification(data: {
    requestId?: number;
    event?: string;
    recipients: string;
    subject: string;
    status: string;
    error?: string;
  }): Promise<void> {
    try {
      const entry: Record<string, unknown> = {
        event: data.event ?? '',
        recipients: data.recipients,
        subject: data.subject,
        status: data.status,
        error: data.error ?? null,
      };
      if (data.requestId !== undefined) {
        entry.requestId = data.requestId;
      }
      const logEntry = this.notificationLogRepo.create(entry as any);
      await this.notificationLogRepo.save(logEntry);
    } catch (logErr) {
      this.logger.error(`Failed to persist notification log: ${(logErr as Error).message}`);
    }
  }

  private resolveStageLabel(request: CarRequest): string {
    const r = request as any;

    if (r.finalInspectionAt) {
      if (r.status === 'archived_qc' || r.status === 'archived_manual') {
        return 'Archived';
      }
      if (r.gpsConfirmedAt && r.registeredAt && r.deliveredAt) {
        return 'Delivered';
      }
      if (r.gpsConfirmedAt && r.registeredAt) {
        return 'Registration';
      }
      if (r.gpsConfirmedAt) {
        return 'GPS Confirmed';
      }
      if (r.finalInspectionOutcome === 'done') {
        return 'Final Inspection (Done)';
      }
      return 'Final Inspection';
    }
    if (r.accessoriesCompletedAt) return 'Accessories';
    if (r.sentToAccessoriesAt) return 'Sent to Accessories';
    if (r.pdiCompletedAt) return 'PDI';
    if (r.pdiStartedAt) return 'PDI (In Progress)';
    if (r.mechanicalCheckCompletedAt) return 'Mechanical Check';
    if (r.mechanicalCheckStartedAt) return 'Mechanical Check (In Progress)';
    if (r.vehicleReceivedAt) return 'Showroom';
    if (r.storageAt) return 'Storage (Dispatched)';
    return 'Created';
  }

  async debugTriggerNotification(event: string, requestId: number, toEmail?: string) {
    if (!(event in LEGACY_EVENT_MAP)) {
      throw new BadRequestException(
        `Unknown event: "${event}". Valid events: ${Object.keys(LEGACY_EVENT_MAP).join(', ')}`
      );
    }

    const request = await this.requestsRepo.findOne({
      where: { id: requestId },
      relations: ['brand', 'model', 'variant', 'requestType'],
    });
    if (!request) {
      throw new BadRequestException(`Request #${requestId} not found`);
    }

    const mappedEvent = LEGACY_EVENT_MAP[event];
    const payload: NotificationPayload = {
      requestId: request.id,
      request: {
        chassisNumber: request.chassisNumber,
        brand: request.brand?.label ?? '',
        model: request.model?.label ?? '',
        variant: request.variant?.label,
        customerName: request.customerName,
        requestType: request.requestType?.value ?? '',
        currentStage: this.resolveStageLabel(request),
        hasGps: request.hasGps,
        hasAccessories: request.hasAccessories,
      },
    };

    this.logger.log(`[DEBUG] Emitting ${mappedEvent} for request #${requestId}`);
    this.eventEmitter.emit(mappedEvent, payload);

    // Send debug email — use explicit recipient if provided, else fall back to admin emails
    const recipients = toEmail
      ? [toEmail]
      : (await this.userRepo.find({
          where: { role: 'super_admin' as any, isActive: true },
          select: ['email'],
        })).map(u => u.email).filter(Boolean) as string[];

    if (recipients.length > 0) {
      await this.send({
        to: recipients,
        subject: `[DEBUG] ${event} — Request #${request.chassisNumber}`,
        template: 'stage-action',
        context: {
          title: `[DEBUG] ${event}`,
          message: `Debug notification for event "${event}" on request #${requestId} (${request.chassisNumber}).`,
          request: payload.request,
          ctaUrl: `${process.env.APP_BASE_URL || 'http://localhost:5173'}/tracker`,
        },
        requestId: request.id,
        event: mappedEvent,
      });
    }

    return {
      success: true,
      event: mappedEvent,
      requestId,
      chassisNumber: request.chassisNumber,
      message: `Event emitted + direct email sent to ${recipients.length} recipient(s): ${recipients.join(', ')}`,
    };
  }

  private renderEmailHtml(context: Record<string, unknown>): string {
    const req = (context.request as Record<string, any>) || {};
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f8;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
<div style="background:#e94560;color:#fff;padding:20px;text-align:center;">
<h1 style="margin:0;font-size:20px;">${context.title || 'OTD BYD Desk'}</h1>
</div>
<div style="padding:24px;">
<p style="color:#333;font-size:15px;">${context.message || ''}</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Chassis</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${req.chassisNumber || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Brand/Model</td><td style="padding:8px;border-bottom:1px solid #eee;">${[req.brand, req.model, req.variant].filter(Boolean).join(' ') || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Customer</td><td style="padding:8px;border-bottom:1px solid #eee;">${req.customerName || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Stage</td><td style="padding:8px;border-bottom:1px solid #eee;color:#e94560;font-weight:600;">${req.currentStage || '—'}</td></tr>
</table>${context.ctaUrl ? `<div style="text-align:center;margin-top:24px;"><a href="${context.ctaUrl}" style="display:inline-block;background:#e94560;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">View in Tracker</a></div>` : ''}</div>
<div style="padding:12px;text-align:center;color:#999;font-size:11px;">BYD OTD Tracker — Automated Notification</div>
</div></body></html>`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
