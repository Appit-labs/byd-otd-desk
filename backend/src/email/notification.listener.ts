import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity.js';
import { EmailService } from './email.service.js';
import { NOTIFICATION_EVENTS } from './notification.events.js';
import type { NotificationPayload } from './notification.events.js';

// Map event → which role(s) receive the email
const EVENT_ROLE_MAP: Record<string, string[]> = {
  [NOTIFICATION_EVENTS.REQUEST_CREATED]:           ['nvs'],
  [NOTIFICATION_EVENTS.VEHICLE_DISPATCHED]:        ['qc_nvs'],
  [NOTIFICATION_EVENTS.VEHICLE_RECEIVED]:          ['mechanical_check'],
  [NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE]: ['pdi', 'qc_nvs'],
  [NOTIFICATION_EVENTS.PDI_COMPLETE]:              ['qc_nvs'],
  [NOTIFICATION_EVENTS.SENT_TO_ACCESSORIES]:       ['accessories'],
  [NOTIFICATION_EVENTS.ACCESSORIES_COMPLETE]:      ['qc_nvs'],
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE]:     ['mechanical_check', 'registration'],
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_ARCHIVED]: ['admin', 'super_admin'],
  [NOTIFICATION_EVENTS.GPS_CONFIRMED]:             ['registration'],
  [NOTIFICATION_EVENTS.REGISTRATION_DONE]:         ['delivery'],
  [NOTIFICATION_EVENTS.REQUEST_CANCELLED]:         ['admin', 'super_admin'],
  [NOTIFICATION_EVENTS.REQUEST_ARCHIVED_MANUAL]:   ['admin', 'super_admin'],
};

const EVENT_META: Record<string, { subject: string; title: string; message: string }> = {
  [NOTIFICATION_EVENTS.REQUEST_CREATED]: {
    subject: 'New Request #{requestNumber} — {customerName}',
    title: 'New Request Created',
    message: 'A new vehicle request has been created and is waiting for dispatch to Storage.',
  },
  [NOTIFICATION_EVENTS.VEHICLE_DISPATCHED]: {
    subject: 'Vehicle Dispatched — Request #{requestNumber}',
    title: 'Vehicle Dispatched',
    message: 'The vehicle has been dispatched from Storage. Please complete Vehicle Received.',
  },
  [NOTIFICATION_EVENTS.VEHICLE_RECEIVED]: {
    subject: 'Vehicle Received at Showroom — Request #{requestNumber}',
    title: 'Vehicle Received',
    message: 'The vehicle has been received at the showroom. Mechanical Check is now ready.',
  },
  [NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE]: {
    subject: 'Mechanical Check Complete — Request #{requestNumber}',
    title: 'Mechanical Check Completed',
    message: 'Mechanical Check has been completed. The next stage is now ready.',
  },
  [NOTIFICATION_EVENTS.PDI_COMPLETE]: {
    subject: 'PDI Complete — Request #{requestNumber}',
    title: 'PDI Completed',
    message: 'PDI has been completed. The next stage is now ready.',
  },
  [NOTIFICATION_EVENTS.SENT_TO_ACCESSORIES]: {
    subject: 'Vehicle Sent to Accessories — Request #{requestNumber}',
    title: 'Sent to Accessories',
    message: 'The vehicle has been confirmed sent to the Accessories team.',
  },
  [NOTIFICATION_EVENTS.ACCESSORIES_COMPLETE]: {
    subject: 'Accessories Complete — Request #{requestNumber}',
    title: 'Accessories Completed',
    message: 'Accessories stage is complete. Final Inspection is now ready.',
  },
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE]: {
    subject: 'Final Inspection Passed — Request #{requestNumber}',
    title: 'Final Inspection Passed',
    message: 'Final Inspection has passed. The next stage is now ready.',
  },
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_ARCHIVED]: {
    subject: 'Request Archived — #{requestNumber}',
    title: 'Request Archived from Final Inspection',
    message: 'A request has been archived as a result of the Final Inspection outcome.',
  },
  [NOTIFICATION_EVENTS.GPS_CONFIRMED]: {
    subject: 'GPS Confirmed — Registration Ready — #{requestNumber}',
    title: 'GPS Confirmed',
    message: 'GPS stage has been confirmed. Registration is now ready.',
  },
  [NOTIFICATION_EVENTS.REGISTRATION_DONE]: {
    subject: 'Registration Done — Delivery Ready — #{requestNumber}',
    title: 'Registration Complete',
    message: 'The vehicle has been registered. It is now ready for Delivery.',
  },
  [NOTIFICATION_EVENTS.REQUEST_CANCELLED]: {
    subject: 'Cancelled — #{requestNumber}',
    title: 'Request Cancelled',
    message: 'A request has been cancelled and no further actions can be taken.',
  },
  [NOTIFICATION_EVENTS.REQUEST_ARCHIVED_MANUAL]: {
    subject: 'Archived — #{requestNumber}',
    title: 'Request Archived',
    message: 'A request has been manually archived.',
  },
};

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @OnEvent('notification.**', { async: true })
  async handleStageEvent(event: string, payload: NotificationPayload): Promise<void> {
    try {
      let targetRoles = EVENT_ROLE_MAP[event] ?? [];

      // Dynamic role filtering based on request properties
      if (event === NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE) {
        const rtVal = payload.request.requestType?.toLowerCase();
        targetRoles = (rtVal === 'pdi' || rtVal === 're_pdi') ? ['pdi'] : ['qc_nvs'];
      }
      if (event === NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE) {
        targetRoles = payload.request.hasGps ? ['mechanical_check'] : ['registration'];
      }

      // Always include admin for visibility
      if (!targetRoles.includes('admin')) {
        targetRoles.push('admin');
      }

      if (targetRoles.length === 0) {
        this.logger.warn(`No target roles for event: ${event}`);
        return;
      }

      // Fetch email addresses for all users with target roles
      const users = await this.userRepo
        .createQueryBuilder('user')
        .where('user.role IN (:...roles)', { roles: targetRoles })
        .andWhere('user.email IS NOT NULL')
        .andWhere('user.isActive = true')
        .andWhere('user.notificationsEnabled = true')
        .select(['user.email'])
        .getMany();

      const recipients = users.map(u => u.email).filter(Boolean) as string[];

      if (recipients.length === 0) {
        this.logger.warn(`No active users with emails for roles: ${targetRoles.join(', ')}`);
        return;
      }

      const meta = EVENT_META[event];
      const subject = meta.subject
        .replace('{requestNumber}', payload.request.chassisNumber)
        .replace('{customerName}', payload.request.customerName);

      await this.emailService.send({
        to: recipients,
        subject,
        template: 'stage-action',
        context: {
          title: meta.title,
          message: meta.message,
          request: payload.request,
          ctaUrl: `${process.env.APP_BASE_URL || 'http://localhost:5173'}/tracker`,
        },
        requestId: payload.requestId,
        event,
      });

    } catch (err) {
      this.logger.error(`Notification handler error for event ${event}: ${(err as Error).message}`);
    }
  }
}
