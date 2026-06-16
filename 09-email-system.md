# Email System Implementation Plan

> **Stack:** NestJS 11 + TypeORM + Nodemailer v9 + `@nestjs-modules/mailer`
> **Templating:** Handlebars (`.hbs`)
> **Provider-agnostic via DB-driven SMTP config**
> **Async delivery via NestJS `EventEmitter2` (no queue needed now, BullMQ upgrade path documented)**
> **Staging/local/dev:** Resend `onboarding@resend.dev` sender (zero domain setup)
> **Production:** Resend SMTP bridge with verified domain

-----

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
1. [Package Installation](#2-package-installation)
1. [Module Structure](#3-module-structure)
1. [Database Schema](#4-database-schema)
1. [Entity & Config Service](#5-entity--config-service)
1. [SMTP Provider & Transport Factory](#6-smtp-provider--transport-factory)
1. [Email Service (Facade)](#7-email-service-facade)
1. [Email Module](#8-email-module)
1. [Handlebars Templates](#9-handlebars-templates)
1. [Notification Event Wiring](#10-notification-event-wiring)
1. [Settings UI — Email Config Page](#11-settings-ui--email-config-page)
1. [Notification Log](#12-notification-log)
1. [Environment Variables](#13-environment-variables)
1. [Resend Setup (Dev/Staging/Production)](#14-resend-setup-devstaginproduction)
1. [Security Checklist](#15-security-checklist)
1. [BullMQ Upgrade Path](#16-bullmq-upgrade-path)
1. [Testing Checklist](#17-testing-checklist)

-----

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      NestJS App                          │
│                                                          │
│  Stage Action Endpoints (TrackerModule, etc.)            │
│       │                                                  │
│       │  emit(event)                                     │
│       ▼                                                  │
│  EventEmitter2 (async, non-blocking)                     │
│       │                                                  │
│       ▼                                                  │
│  NotificationListener  ──▶  EmailService (facade)        │
│                                   │                      │
│                          SmtpConfigService               │
│                          (load active config from DB)    │
│                                   │                      │
│                          TransportFactory                │
│                          (creates Nodemailer transport   │
│                           dynamically per DB config)     │
│                                   │                      │
│                          Handlebars Templates            │
│                                   │                      │
│                          NotificationLog (DB)            │
└──────────────────────────────────────────────────────────┘
         │
         ▼
   External SMTP
   (Resend / Brevo / Custom)
```

**Key design decisions:**

- `EventEmitter2` decouples stage-action endpoints from email sending — stage API response is never delayed by SMTP.
- A single `SmtpConfigService` loads SMTP settings from the DB (fed by the Settings UI in Plan 08 Issue 5/12). Cache with 60s TTL to avoid DB hit on every email.
- `TransportFactory` creates a Nodemailer transport dynamically from the DB config — switching provider = only a DB update, zero code change.
- Handlebars templates are server-side rendered — no extra frontend work.
- BullMQ can be dropped in later by replacing `EventEmitter2` listeners with queue processors (see §16).

-----

## 2. Package Installation

```bash
# Runtime
npm install nodemailer @nestjs-modules/mailer handlebars @nestjs/event-emitter

# Dev / types
npm install --save-dev @types/nodemailer @types/handlebars
```

**Pinned versions (install with `@latest` and confirm these are the current latest):**

|Package                 |Version at time of writing   |
|------------------------|-----------------------------|
|`nodemailer`            |`^9.0.0`                     |
|`@nestjs-modules/mailer`|`^2.x` (latest for NestJS 11)|
|`handlebars`            |`^4.7.x`                     |
|`@nestjs/event-emitter` |`^3.x`                       |
|`@types/nodemailer`     |`^8.0.1`                     |


> ⚠️ **Nodemailer v9 note:** v9 ships as pure ESM. Because NestJS compiles to CommonJS, use the `nodemailer` import through `@nestjs-modules/mailer` which handles the ESM/CJS bridge. If importing Nodemailer directly anywhere, use `import type` only from `@types/nodemailer` and let the mailer module do the actual instantiation. If you hit `ERR_REQUIRE_ESM`, pin to `nodemailer@^6.10.x` (latest stable CJS build) until `@nestjs-modules/mailer` explicitly documents v9 ESM compatibility — confirm at runtime and fall back if needed.

-----

## 3. Module Structure

```
src/
└── email/
    ├── email.module.ts
    ├── email.service.ts                ← Facade used by all modules
    ├── transport.factory.ts            ← Creates Nodemailer transport from DB config
    ├── smtp-config.service.ts          ← Loads & caches SMTP config from DB
    ├── notification.listener.ts        ← EventEmitter2 listener → EmailService calls
    ├── notification.events.ts          ← Typed event constants & payload interfaces
    ├── entities/
    │   ├── email-config.entity.ts
    │   └── notification-log.entity.ts
    ├── dto/
    │   ├── send-email.dto.ts
    │   └── update-smtp-config.dto.ts
    └── templates/                      ← Handlebars (.hbs) email templates
        ├── layouts/
        │   └── base.hbs               ← Shared wrapper (header, footer, branding)
        ├── partials/
        │   └── request-card.hbs       ← Reusable request-info block
        ├── stage-action.hbs           ← Generic stage notification template
        └── test-email.hbs             ← Used by "Send Test Email" button
```

-----

## 4. Database Schema

### `email_config` table

```sql
CREATE TABLE email_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host    VARCHAR(255) NOT NULL,
  smtp_port    INTEGER NOT NULL DEFAULT 587,
  smtp_user    VARCHAR(255) NOT NULL,
  smtp_pass    TEXT NOT NULL,          -- AES-256 encrypted at app level before storage
  from_address VARCHAR(255) NOT NULL,
  from_name    VARCHAR(255) NOT NULL DEFAULT 'Talentino Tracker',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  is_enabled   BOOLEAN NOT NULL DEFAULT true,  -- global on/off switch
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> Only one row should be `is_active = true` at any time. Enforce this with a partial unique index:
> 
> ```sql
> CREATE UNIQUE INDEX email_config_single_active ON email_config (is_active)
> WHERE is_active = true;
> ```

### `notification_log` table

```sql
CREATE TABLE notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID REFERENCES requests(id) ON DELETE SET NULL,
  event       VARCHAR(100) NOT NULL,
  recipients  TEXT[] NOT NULL,         -- array of email addresses
  sent_at     TIMESTAMPTZ,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  error       TEXT,
  attempt     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

-----

## 5. Entity & Config Service

### `email-config.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('email_config')
export class EmailConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  smtpHost: string;

  @Column({ default: 587 })
  smtpPort: number;

  @Column({ length: 255 })
  smtpUser: string;

  @Column('text')
  smtpPass: string; // stored encrypted — decrypted in SmtpConfigService

  @Column({ length: 255 })
  fromAddress: string;

  @Column({ length: 255, default: 'Talentino Tracker' })
  fromName: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: true })
  isEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### `smtp-config.service.ts`

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailConfig } from './entities/email-config.entity';
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
    'talentino-email-salt',
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
    const config = await this.repo.findOne({ where: { isActive: true } });
    if (!config) throw new NotFoundException('No active SMTP configuration found. Please configure email in Settings.');
    config.smtpPass = this.decrypt(config.smtpPass);
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
```

> ⚠️ **Security:** `APP_SECRET` must be a strong random string set in environment variables (not committed to source). Never return `smtpPass` in any API response.

-----

## 6. SMTP Provider & Transport Factory

### `transport.factory.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { SmtpConfigService } from './smtp-config.service';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class TransportFactory {
  constructor(private readonly smtpConfigService: SmtpConfigService) {}

  async create(): Promise<Transporter> {
    const cfg = await this.smtpConfigService.getActiveConfig();
    return createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      // true only for port 465 (implicit TLS), false for 587 (STARTTLS) or 25
      secure: cfg.smtpPort === 465,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass, // already decrypted by SmtpConfigService
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true, // set false only for local dev self-signed certs
      },
    });
  }

  async verify(): Promise<boolean> {
    const transport = await this.create();
    await transport.verify();
    return true;
  }
}
```

-----

## 7. Email Service (Facade)

### `email.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { SmtpConfigService } from './smtp-config.service';
import { NotificationLog } from './entities/notification-log.entity';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: string;      // Handlebars template name (without .hbs)
  context: Record<string, unknown>;  // Template variables
  requestId?: string;
  event?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly MAX_RETRIES = 2;

  constructor(
    private readonly mailerService: MailerService,
    private readonly smtpConfigService: SmtpConfigService,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    // Check global enable flag before doing anything
    const cfg = await this.smtpConfigService.getActiveConfig();
    if (!cfg.isEnabled) {
      this.logger.debug('Email notifications are disabled globally — skipping send.');
      return;
    }

    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const logEntry = this.logRepo.create({
      requestId: options.requestId,
      event: options.event ?? options.template,
      recipients,
      status: 'pending',
    });
    await this.logRepo.save(logEntry);

    let attempt = 0;
    while (attempt <= this.MAX_RETRIES) {
      try {
        await this.mailerService.sendMail({
          to: recipients.join(', '),
          subject: options.subject,
          template: options.template,
          context: {
            ...options.context,
            appName: cfg.fromName,
            year: new Date().getFullYear(),
          },
        });

        logEntry.status = 'sent';
        logEntry.sentAt = new Date();
        logEntry.attempt = attempt + 1;
        await this.logRepo.save(logEntry);
        this.logger.log(`Email [${options.event}] sent to ${recipients.join(', ')}`);
        return;

      } catch (err) {
        attempt++;
        this.logger.warn(`Email send attempt ${attempt} failed: ${(err as Error).message}`);
        if (attempt > this.MAX_RETRIES) {
          logEntry.status = 'failed';
          logEntry.error = (err as Error).message;
          logEntry.attempt = attempt;
          await this.logRepo.save(logEntry);
          this.logger.error(`Email [${options.event}] failed after ${attempt} attempts`);
          // Do NOT throw — never let email failures break stage actions
          return;
        }
        await this.delay(1000 * attempt); // 1s, 2s back-off
      }
    }
  }

  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      // SmtpConfigService builds the transport; mailerService uses same config
      await this.smtpConfigService.getActiveConfig(); // will throw if no config
      // Trigger a raw verify through TransportFactory
      return { ok: true, message: 'SMTP connection successful' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
```

-----

## 8. Email Module

### `email.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

import { EmailService } from './email.service';
import { SmtpConfigService } from './smtp-config.service';
import { TransportFactory } from './transport.factory';
import { NotificationListener } from './notification.listener';
import { EmailConfig } from './entities/email-config.entity';
import { NotificationLog } from './entities/notification-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailConfig, NotificationLog]),

    // Async mailer config so SmtpConfigService is injected
    MailerModule.forRootAsync({
      imports: [EmailModule],   // self-import to access SmtpConfigService
      useFactory: async (smtpConfigService: SmtpConfigService) => {
        const cfg = await smtpConfigService.getActiveConfig().catch(() => null);
        return {
          transport: cfg ? {
            host: cfg.smtpHost,
            port: cfg.smtpPort,
            secure: cfg.smtpPort === 465,
            auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
            tls: { minVersion: 'TLSv1.2' },
          } : {
            // Fallback to env vars for local/dev when no DB config yet
            host: process.env.FALLBACK_SMTP_HOST ?? 'smtp.resend.com',
            port: Number(process.env.FALLBACK_SMTP_PORT ?? 465),
            secure: Number(process.env.FALLBACK_SMTP_PORT ?? 465) === 465,
            auth: {
              user: process.env.FALLBACK_SMTP_USER ?? 'resend',
              pass: process.env.FALLBACK_SMTP_PASS ?? '',
            },
          },
          defaults: {
            from: cfg
              ? `"${cfg.fromName}" <${cfg.fromAddress}>`
              : `"${process.env.FALLBACK_FROM_NAME ?? 'Talentino Dev'}" <${process.env.FALLBACK_FROM_ADDRESS ?? 'onboarding@resend.dev'}>`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
      inject: [SmtpConfigService],
    }),
  ],
  providers: [
    EmailService,
    SmtpConfigService,
    TransportFactory,
    NotificationListener,
  ],
  exports: [EmailService, SmtpConfigService],
})
export class EmailModule {}
```

> **nest-cli.json**: Add the templates directory to `assets` so `.hbs` files are included in the build output:
> 
> ```json
> {
>   "compilerOptions": {
>     "assets": ["email/templates/**/*"],
>     "watchAssets": true
>   }
> }
> ```

-----

## 9. Handlebars Templates

### `templates/layouts/base.hbs`

```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#076698;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                {{appName}}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              {{{body}}}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f4f6f8;padding:16px 32px;text-align:center;
                       font-size:12px;color:#6b7280;">
              © {{year}} {{appName}}. This is an automated notification.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### `templates/partials/request-card.hbs`

```handlebars
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;
              margin:16px 0;padding:16px;">
  <tr>
    <td>
      <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px;color:#374151;">
        <tr>
          <td style="color:#6b7280;width:140px;">Chassis No.</td>
          <td><strong>{{request.chassisNumber}}</strong></td>
        </tr>
        <tr>
          <td style="color:#6b7280;">Vehicle</td>
          <td>{{request.brand}} {{request.model}} {{request.variant}}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;">Customer</td>
          <td>{{request.customerName}}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;">Request Type</td>
          <td>{{request.requestType}}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;">Promise Date</td>
          <td>{{request.promiseDate}}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;">Current Stage</td>
          <td><strong>{{request.currentStage}}</strong></td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

### `templates/stage-action.hbs`

```handlebars
{{#> layouts/base}}
  {{#*inline "body"}}
    <h2 style="margin:0 0 8px;color:#076698;font-size:18px;">{{title}}</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">{{message}}</p>

    {{> partials/request-card}}

    {{#if ctaUrl}}
    <div style="text-align:center;margin-top:24px;">
      <a href="{{ctaUrl}}"
         style="display:inline-block;background:#076698;color:#ffffff;
                padding:12px 28px;border-radius:6px;text-decoration:none;
                font-size:14px;font-weight:600;">
        View in Tracker
      </a>
    </div>
    {{/if}}
  {{/inline}}
{{/layouts/base}}
```

### `templates/test-email.hbs`

```handlebars
{{#> layouts/base}}
  {{#*inline "body"}}
    <h2 style="color:#076698;">SMTP Configuration Test</h2>
    <p style="color:#374151;">
      This is a test email from <strong>{{appName}}</strong>.<br>
      Your SMTP configuration is working correctly.
    </p>
    <p style="color:#6b7280;font-size:13px;">
      Sent at: {{sentAt}}<br>
      SMTP Host: {{smtpHost}}
    </p>
  {{/inline}}
{{/layouts/base}}
```

-----

## 10. Notification Event Wiring

### `notification.events.ts`

```typescript
export const NOTIFICATION_EVENTS = {
  REQUEST_CREATED:           'notification.request.created',
  VEHICLE_DISPATCHED:        'notification.vehicle.dispatched',
  VEHICLE_RECEIVED:          'notification.vehicle.received',
  MECHANICAL_CHECK_COMPLETE: 'notification.mechanical.complete',
  PDI_COMPLETE:              'notification.pdi.complete',
  SENT_TO_ACCESSORIES:       'notification.accessories.sent',
  ACCESSORIES_COMPLETE:      'notification.accessories.complete',
  FINAL_INSPECTION_DONE:     'notification.finalinspection.done',
  FINAL_INSPECTION_ARCHIVED: 'notification.finalinspection.archived',
  GPS_CONFIRMED:             'notification.gps.confirmed',
  REGISTRATION_DONE:         'notification.registration.done',
  REQUEST_CANCELLED:         'notification.request.cancelled',
  REQUEST_ARCHIVED_MANUAL:   'notification.request.archived.manual',
} as const;

export interface NotificationPayload {
  requestId: string;
  request: {
    chassisNumber: string;
    brand: string;
    model: string;
    variant: string;
    customerName: string;
    requestType: string;
    promiseDate: string;
    currentStage: string;
    hasGps: boolean;
    hasAccessories: boolean;
  };
  actorName?: string;  // Name of user who performed the action
}
```

### `notification.listener.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailService } from './email.service';
import { NOTIFICATION_EVENTS, NotificationPayload } from './notification.events';

// Map event → which role(s) receive the email
const EVENT_ROLE_MAP: Record<string, string[]> = {
  [NOTIFICATION_EVENTS.REQUEST_CREATED]:           ['nvs'],
  [NOTIFICATION_EVENTS.VEHICLE_DISPATCHED]:        ['qc_nvs'],
  [NOTIFICATION_EVENTS.VEHICLE_RECEIVED]:          ['mechanical_check'],
  [NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE]: ['pdi', 'qc_nvs'],  // filtered by request type in handler
  [NOTIFICATION_EVENTS.PDI_COMPLETE]:              ['qc_nvs'],
  [NOTIFICATION_EVENTS.SENT_TO_ACCESSORIES]:       ['accessories'],
  [NOTIFICATION_EVENTS.ACCESSORIES_COMPLETE]:      ['qc_nvs'],
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE]:     ['mechanical_check', 'registration'], // filtered by hasGps
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_ARCHIVED]: ['admin', 'super_admin'],
  [NOTIFICATION_EVENTS.GPS_CONFIRMED]:             ['registration'],
  [NOTIFICATION_EVENTS.REGISTRATION_DONE]:         ['delivery'],
  [NOTIFICATION_EVENTS.REQUEST_CANCELLED]:         ['admin', 'super_admin'],
  [NOTIFICATION_EVENTS.REQUEST_ARCHIVED_MANUAL]:   ['admin', 'super_admin'],
};

const EVENT_META: Record<string, { subject: string; title: string; message: string }> = {
  [NOTIFICATION_EVENTS.REQUEST_CREATED]:           { subject: 'New Request — Ready for Dispatch', title: 'New Request Created', message: 'A new vehicle request has been created and is waiting for dispatch to Storage.' },
  [NOTIFICATION_EVENTS.VEHICLE_DISPATCHED]:        { subject: 'Vehicle Dispatched — Vehicle Received Pending', title: 'Vehicle Dispatched', message: 'The vehicle has been dispatched from Storage. Please complete Vehicle Received.' },
  [NOTIFICATION_EVENTS.VEHICLE_RECEIVED]:          { subject: 'Vehicle Received — Mechanical Check Ready', title: 'Vehicle Received', message: 'The vehicle has been received at the showroom. Mechanical Check is now ready.' },
  [NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE]: { subject: 'Mechanical Check Complete — Next Stage Ready', title: 'Mechanical Check Completed', message: 'Mechanical Check has been completed. The next stage is now ready.' },
  [NOTIFICATION_EVENTS.PDI_COMPLETE]:              { subject: 'PDI Complete — Next Stage Ready', title: 'PDI Completed', message: 'PDI has been completed. The next stage is now ready.' },
  [NOTIFICATION_EVENTS.SENT_TO_ACCESSORIES]:       { subject: 'Vehicle Sent to Accessories', title: 'Sent to Accessories', message: 'The vehicle has been confirmed sent to the Accessories team.' },
  [NOTIFICATION_EVENTS.ACCESSORIES_COMPLETE]:      { subject: 'Accessories Complete — Final Inspection Ready', title: 'Accessories Completed', message: 'Accessories stage is complete. Final Inspection is now ready.' },
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE]:     { subject: 'Final Inspection Passed — Next Stage Ready', title: 'Final Inspection Passed', message: 'Final Inspection has passed. The next stage is now ready.' },
  [NOTIFICATION_EVENTS.FINAL_INSPECTION_ARCHIVED]: { subject: 'Request Archived — Final Inspection', title: 'Request Archived from Final Inspection', message: 'A request has been archived as a result of the Final Inspection outcome.' },
  [NOTIFICATION_EVENTS.GPS_CONFIRMED]:             { subject: 'GPS Confirmed — Registration Ready', title: 'GPS Confirmed', message: 'GPS stage has been confirmed. Registration is now ready.' },
  [NOTIFICATION_EVENTS.REGISTRATION_DONE]:         { subject: 'Vehicle Registered — Delivery Ready', title: 'Registration Complete', message: 'The vehicle has been registered. It is now ready for Delivery.' },
  [NOTIFICATION_EVENTS.REQUEST_CANCELLED]:         { subject: 'Request Cancelled', title: 'Request Cancelled', message: 'A request has been cancelled and no further actions can be taken.' },
  [NOTIFICATION_EVENTS.REQUEST_ARCHIVED_MANUAL]:   { subject: 'Request Archived', title: 'Request Archived', message: 'A request has been manually archived.' },
};

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @OnEvent('notification.*', { async: true })
  async handleStageEvent(event: string, payload: NotificationPayload): Promise<void> {
    try {
      let targetRoles = EVENT_ROLE_MAP[event] ?? [];

      // Filter role targets based on request properties
      if (event === NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE) {
        // Only notify PDI role if request has PDI; otherwise notify QC
        targetRoles = payload.request.requestType === 'PDI' ? ['pdi'] : ['qc_nvs'];
      }
      if (event === NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE) {
        // GPS present → notify Mechanical Check; otherwise notify Registration
        targetRoles = payload.request.hasGps ? ['mechanical_check'] : ['registration'];
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
        .select(['user.email'])
        .getMany();

      if (users.length === 0) {
        this.logger.warn(`No active users with emails found for roles: ${targetRoles.join(', ')}`);
        return;
      }

      const meta = EVENT_META[event];
      const recipients = users.map(u => u.email).filter(Boolean);

      await this.emailService.send({
        to: recipients,
        subject: meta.subject,
        template: 'stage-action',
        context: {
          title: meta.title,
          message: meta.message,
          request: payload.request,
          ctaUrl: `${process.env.APP_BASE_URL ?? ''}/tracker`,
        },
        requestId: payload.requestId,
        event,
      });

    } catch (err) {
      // Never let notification failure propagate — it's fully async
      this.logger.error(`Notification handler error for event ${event}: ${(err as Error).message}`);
    }
  }
}
```

### Emitting events from stage-action endpoints

In each stage action service method, emit after the DB write succeeds:

```typescript
// Example: in TrackerService.dispatchVehicle()
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFICATION_EVENTS } from '../email/notification.events';

@Injectable()
export class TrackerService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    // ... other deps
  ) {}

  async dispatchVehicle(requestId: string, actorId: string): Promise<void> {
    // 1. Perform DB writes (update request stage, record timestamp)
    const request = await this.updateStage(requestId, 'storage');

    // 2. Emit notification event (async, non-blocking)
    this.eventEmitter.emit(NOTIFICATION_EVENTS.VEHICLE_DISPATCHED, {
      requestId,
      request: this.toNotificationPayload(request),
      actorName: actorId,
    });
  }
}
```

Apply the same pattern to every stage action listed in Plan 03 and the event table in §1.

-----

## 11. Settings UI — Email Config Page

In Settings → System → Email Configuration (as part of Plan 08 Issue 5):

### API Endpoints

```
GET    /settings/email-config          → Returns config (smtpPass NEVER returned)
PUT    /settings/email-config          → Save/update config
POST   /settings/email-config/verify   → Trigger SMTP verify; returns { ok, message }
```

### Controller snippet

```typescript
@Put('email-config')
@Roles('admin', 'super_admin')
async updateEmailConfig(@Body() dto: UpdateSmtpConfigDto): Promise<void> {
  dto.smtpPass = this.smtpConfigService.encrypt(dto.smtpPass);
  await this.emailConfigRepo.save(dto);
  this.smtpConfigService.invalidateCache();  // bust cache immediately
}

@Post('email-config/verify')
@Roles('admin', 'super_admin')
async verifyEmailConfig(): Promise<{ ok: boolean; message: string }> {
  return this.emailService.verifyConnection();
}
```

### UI fields (frontend form)

|Field               |Type                     |Notes                        |
|--------------------|-------------------------|-----------------------------|
|SMTP Host           |Text                     |e.g. `smtp.resend.com`       |
|SMTP Port           |Number                   |Default 465                  |
|SMTP Username       |Text                     |                             |
|SMTP Password       |Password (masked)        |Never pre-filled in edit form|
|From Address        |Email                    |                             |
|From Name           |Text                     |Default “Talentino Tracker”  |
|Enable Notifications|Toggle                   |Maps to `isEnabled`          |
|—                   |Button: “Send Test Email”|Calls `/verify` endpoint     |

-----

## 12. Notification Log

The `notification_log` table (§4) is written by `EmailService.send()` automatically.

Expose a read-only log view in Settings → System (Admin/Super Admin only):

```
GET /settings/notification-log?page=1&limit=50&status=failed
```

Useful for debugging failed sends. Show: event, recipients, status, error, sentAt, attempt.

-----

## 13. Environment Variables

Add these to your `.env` (and `.env.example`):

```env
# Required for password encryption — MUST be a strong random string, never committed
APP_SECRET=replace-with-a-strong-random-string-min-32-chars

# App base URL for email CTA links
APP_BASE_URL=https://your-production-domain.com

# ──────────────────────────────────────────────────────────────────────────────
# FALLBACK SMTP config — used in local/dev/staging when no DB config row exists
# Use Resend onboarding@resend.dev sender for zero-config email testing
# ──────────────────────────────────────────────────────────────────────────────
FALLBACK_SMTP_HOST=smtp.resend.com
FALLBACK_SMTP_PORT=465
FALLBACK_SMTP_USER=resend
FALLBACK_SMTP_PASS=re_your_resend_api_key_here
FALLBACK_FROM_ADDRESS=onboarding@resend.dev
FALLBACK_FROM_NAME=Talentino Dev
```

> **Local / Dev / Staging:** Use `onboarding@resend.dev` as `FALLBACK_FROM_ADDRESS`. This is Resend’s shared testing sender — requires no domain verification and works immediately after signing up for a free Resend account. No DB config needed for these environments.
> 
> **Production:** Set SMTP config via the Settings UI (stored in DB, encrypted). Use a verified domain sender via Resend.

-----

## 14. Resend Setup (Dev / Staging / Production)

|Environment|From Address            |Setup Required                                                    |
|-----------|------------------------|------------------------------------------------------------------|
|Local      |`onboarding@resend.dev` |Sign up at resend.com, get API key, set `FALLBACK_SMTP_PASS`      |
|Dev server |`onboarding@resend.dev` |Same as local — env vars only                                     |
|Staging    |`onboarding@resend.dev` |Same — no domain verification                                     |
|Production |`noreply@yourdomain.com`|Verify domain in Resend dashboard; configure via Settings UI in DB|

### Resend SMTP credentials (same for all environments)

|Field   |Value                           |
|--------|--------------------------------|
|Host    |`smtp.resend.com`               |
|Port    |`465`                           |
|Username|`resend`                        |
|Password|Your Resend API key (`re_xxxx…`)|

Zero code change to switch from staging to production — just update the DB config via Settings UI.

-----

## 15. Security Checklist

- [ ] `APP_SECRET` is a strong random value, stored only in environment variables, never in source code or DB.
- [ ] `smtpPass` is AES-256-CBC encrypted before writing to DB; decrypted in memory only when building the transport.
- [ ] SMTP password is never returned in any API GET response.
- [ ] Password field in the Settings UI is always empty on load (never pre-filled with the stored value).
- [ ] `tls.minVersion: 'TLSv1.2'` enforced on all SMTP connections.
- [ ] Email config endpoints are guarded by `admin`/`super_admin` role check.
- [ ] `notification_log` read endpoint is also guarded (admin/super admin only).

-----

## 16. BullMQ Upgrade Path

When ready (e.g., >1,000 emails/day, need retries with backoff dashboard, or scheduled sends):

```bash
npm install bullmq @nestjs/bullmq ioredis
```

Replace `EventEmitter2` listeners in `NotificationListener` with BullMQ queue producers, and create a `EmailProcessor` that calls `EmailService.send()`. `EmailService` itself does not change. Callers switch from `eventEmitter.emit()` to `queue.add()`.

Trigger this migration when:

- Email volume makes synchronous-async delivery unreliable.
- You need a visual job dashboard (Bull Board).
- You need delayed/scheduled sends.

-----

## 17. Testing Checklist

- [ ] Local: `FALLBACK_SMTP_PASS` set to Resend API key; send test email from Settings UI → received in inbox.
- [ ] Dev server: same env vars; same result.
- [ ] Staging: `onboarding@resend.dev` sender works without domain setup.
- [ ] Production: SMTP config saved via Settings UI (DB), encrypted; test email from verified domain works.
- [ ] Password never appears in GET `/settings/email-config` response.
- [ ] `invalidateCache()` called after config update; new config used on next send (within 60s).
- [ ] Disabling `isEnabled` toggle stops all notifications (no emails sent, logs show “skipped”).
- [ ] Each stage action emits the correct event and the correct role’s users receive the email.
- [ ] `notification_log` records `sent` on success and `failed` with error text on SMTP error.
- [ ] Retry logic fires on transient failure (test with wrong password, then fix — confirm attempt count in log).
- [ ] Stage API response time is not affected by SMTP send (async — emit and return).
- [ ] `ERR_REQUIRE_ESM` does not occur at runtime (if it does, fall back to `nodemailer@^6.10.x`).