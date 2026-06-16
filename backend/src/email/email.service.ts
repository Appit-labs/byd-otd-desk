import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailConfig } from '../database/entities/email-config.entity.js';
import { NotificationLog } from '../database/entities/notification-log.entity.js';
import { User } from '../database/entities/user.entity.js';
import type { CarRequest } from '../database/entities/car-request.entity.js';
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
    private readonly mailerService: MailerService,
    private readonly smtpConfigService: SmtpConfigService,
    private readonly transportFactory: TransportFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  //  Config Management (kept exactly as before)
  // ─────────────────────────────────────────────────────────────────

  async getConfig(): Promise<Partial<EmailConfig> & { smtpPassword?: string }> {
    let config = await this.emailConfigRepo.findOne({ where: {} });

    if (!config) {
      config = this.emailConfigRepo.create({
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        fromAddress: '',
        fromName: 'OTD BYD Tracker',
        enabled: false,
      });
      config = await this.emailConfigRepo.save(config);
    }

    const masked = { ...config, smtpPassword: config.smtpPassword ? '********' : '' };
    return masked;
  }

  async updateConfig(data: UpdateEmailConfigDto): Promise<EmailConfig> {
    let config = await this.emailConfigRepo.findOne({ where: {} });

    if (!config) {
      config = this.emailConfigRepo.create();
    }

    if (data.smtpHost !== undefined) config.smtpHost = data.smtpHost;
    if (data.smtpPort !== undefined) config.smtpPort = data.smtpPort;
    if (data.smtpUsername !== undefined) config.smtpUsername = data.smtpUsername;
    if (data.smtpPassword !== undefined) config.smtpPassword = data.smtpPassword;
    if (data.fromAddress !== undefined) config.fromAddress = data.fromAddress;
    if (data.fromName !== undefined) config.fromName = data.fromName;
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
      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'OTD BYD Tracker — Test Email',
        template: 'test-email',
        context: {
          sentAt: new Date().toISOString(),
          smtpHost: config.smtpHost || process.env.FALLBACK_SMTP_HOST || 'smtp.resend.com',
        },
      });

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

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.mailerService.sendMail({
          to: to.join(', '),
          subject: options.subject,
          template: options.template,
          context: options.context,
        });

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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
