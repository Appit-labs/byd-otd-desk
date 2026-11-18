import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { EmailController } from './email.controller.js';
import { EmailService } from './email.service.js';
import { SmtpConfigService } from './smtp-config.service.js';
import { TransportFactory } from './transport.factory.js';
import { NotificationListener } from './notification.listener.js';
import { EmailConfig } from '../database/entities/email-config.entity.js';
import { NotificationLog } from '../database/entities/notification-log.entity.js';
import { User } from '../database/entities/user.entity.js';
import { CarRequest } from '../database/entities/car-request.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailConfig, NotificationLog, User, CarRequest]),
    EventEmitterModule.forRoot(),
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.FALLBACK_SMTP_HOST || 'smtp.resend.com',
          port: Number(process.env.FALLBACK_SMTP_PORT || 465),
          secure: Number(process.env.FALLBACK_SMTP_PORT || 465) === 465,
          auth: {
            user: process.env.FALLBACK_SMTP_USER || 'resend',
            pass: process.env.FALLBACK_SMTP_PASS || '',
          },
          tls: {
            minVersion: 'TLSv1.2' as const,
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        },
        defaults: {
          from: `"${process.env.FALLBACK_FROM_NAME || 'BYD OTD Tracker'}" <${process.env.FALLBACK_FROM_ADDRESS || 'onboarding@resend.dev'}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
  ],
  controllers: [EmailController],
  providers: [
    EmailService,
    SmtpConfigService,
    TransportFactory,
    NotificationListener,
  ],
  exports: [EmailService, SmtpConfigService, NotificationListener],
})
export class EmailModule {}
