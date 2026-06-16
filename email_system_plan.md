# Email System Implementation Plan

> **Stack:** NestJS + Nodemailer · **Provider-agnostic via SMTP config** · **Resend-ready**
> **Current state:** Async direct send (no queue)
> **Goal:** Clean, provider-agnostic email service with DB-driven SMTP config

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [Database / Config Storage](#3-database--config-storage)
4. [Core Implementation](#4-core-implementation)
5. [Resend via SMTP Bridge](#5-resend-via-smtp-bridge)
6. [Email Templates](#6-email-templates)
7. [Error Handling & Retry](#7-error-handling--retry)
8. [Future: BullMQ Migration Path](#8-future-bullmq-migration-path)
9. [Environment Variables](#9-environment-variables)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    NestJS App                        │
│                                                      │
│  Any Module (Auth, User, etc.)                       │
│       │                                              │
│       ▼                                              │
│  EmailService (facade)                               │
│       │                                              │
│       ├──▶ SmtpConfigService (load from DB/env)      │
│       │         │                                    │
│       │         ▼                                    │
│       └──▶ NodemailerTransport (dynamic per config)  │
│                 │                                    │
│                 ▼                                    │
│       IEmailProvider (interface)                     │
│          │              │                            │
│     SmtpProvider    ResendProvider (future)          │
└──────────────────────────────────────────────────────┘
         │
         ▼
   External SMTP
   (Resend / Brevo / Custom SMTP)
```

**Key design decisions:**
- `IEmailProvider` interface decouples sending logic from provider
- SMTP config is loaded dynamically from DB (your existing config page feeds this)
- Switching provider = updating DB config page only, zero code change
- BullMQ can be dropped in later by wrapping `EmailService.send()` calls in a job

---

## 2. Module Structure

```
src/
└── email/
    ├── email.module.ts
    ├── email.service.ts            ← Facade: used by all other modules
    ├── interfaces/
    │   └── email-provider.interface.ts
    ├── providers/
    │   ├── smtp.provider.ts        ← Nodemailer SMTP (covers Resend SMTP bridge)
    │   └── resend-api.provider.ts  ← (optional) Resend native API provider
    ├── config/
    │   └── smtp-config.service.ts  ← Loads config from DB or env
    ├── templates/
    │   ├── base.template.ts
    │   └── welcome.template.ts     ← Example template
    ├── dto/
    │   └── send-email.dto.ts
    └── email.constants.ts
```

---

## 3. Database / Config Storage

Your existing email config page saves to a `email_config` table. Use this schema:

```sql
CREATE TABLE email_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host   VARCHAR(255) NOT NULL,
  smtp_port   INTEGER NOT NULL DEFAULT 465,
  smtp_user   VARCHAR(255) NOT NULL,
  smtp_pass   TEXT NOT NULL,           -- store encrypted
  from_address VARCHAR(255) NOT NULL,
  from_name   VARCHAR(255) NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

> ⚠️ **Security:** Encrypt `smtp_pass` at rest. Use `pgcrypto` or encrypt at app level
> before storing. Never return the raw password in API responses.

---

## 4. Core Implementation

### 4.1 Interface — `email-provider.interface.ts`

```typescript
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface IEmailProvider {
  send(options: SendEmailOptions): Promise<void>;
  verify(): Promise<boolean>;   // test connection
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
```

---

### 4.2 SMTP Config Service — `smtp-config.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailConfig } from '../entities/email-config.entity';

@Injectable()
export class SmtpConfigService {
  private cachedConfig: EmailConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60_000; // 60s cache to avoid DB hit per email

  constructor(
    @InjectRepository(EmailConfig)
    private readonly repo: Repository<EmailConfig>,
  ) {}

  async getActiveConfig(): Promise<EmailConfig> {
    const now = Date.now();
    if (this.cachedConfig && now < this.cacheExpiry) {
      return this.cachedConfig;
    }

    const config = await this.repo.findOne({ where: { is_active: true } });
    if (!config) throw new Error('No active email configuration found');

    this.cachedConfig = config;
    this.cacheExpiry = now + this.CACHE_TTL;
    return config;
  }

  // Call this after admin updates config to bust cache immediately
  invalidateCache(): void {
    this.cachedConfig = null;
    this.cacheExpiry = 0;
  }
}
```

---

### 4.3 SMTP Provider — `smtp.provider.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SmtpConfigService } from '../config/smtp-config.service';
import { IEmailProvider, SendEmailOptions } from '../interfaces/email-provider.interface';

@Injectable()
export class SmtpProvider implements IEmailProvider {
  private readonly logger = new Logger(SmtpProvider.name);

  constructor(private readonly smtpConfigService: SmtpConfigService) {}

  private async createTransport() {
    const config = await this.smtpConfigService.getActiveConfig();

    return nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465,   // true for 465, false for 587
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,           // decrypted at this point
      },
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    const config = await this.smtpConfigService.getActiveConfig();
    const transport = await this.createTransport();

    await transport.sendMail({
      from: `"${config.from_name}" <${config.from_address}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      attachments: options.attachments,
    });

    this.logger.log(`Email sent to ${options.to} via ${config.smtp_host}`);
  }

  async verify(): Promise<boolean> {
    try {
      const transport = await this.createTransport();
      await transport.verify();
      return true;
    } catch (err) {
      this.logger.error('SMTP verification failed', err.message);
      return false;
    }
  }
}
```

---

### 4.4 Email Service (Facade) — `email.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SmtpProvider } from './providers/smtp.provider';
import { SendEmailOptions } from './interfaces/email-provider.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly MAX_RETRIES = 2;

  constructor(private readonly provider: SmtpProvider) {}

  async send(options: SendEmailOptions): Promise<void> {
    let attempt = 0;

    while (attempt <= this.MAX_RETRIES) {
      try {
        await this.provider.send(options);
        return;
      } catch (err) {
        attempt++;
        this.logger.warn(`Email send attempt ${attempt} failed: ${err.message}`);

        if (attempt > this.MAX_RETRIES) {
          this.logger.error(`Email to ${options.to} failed after ${this.MAX_RETRIES + 1} attempts`);
          throw err;   // let caller decide whether to surface to user
        }

        await this.delay(1000 * attempt); // exponential back-off: 1s, 2s
      }
    }
  }

  async verifyConnection(): Promise<boolean> {
    return this.provider.verify();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### 4.5 Email Module — `email.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { SmtpProvider } from './providers/smtp.provider';
import { SmtpConfigService } from './config/smtp-config.service';
import { EmailConfig } from './entities/email-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailConfig])],
  providers: [EmailService, SmtpProvider, SmtpConfigService],
  exports: [EmailService, SmtpConfigService],  // export SmtpConfigService for cache invalidation
})
export class EmailModule {}
```

---

### 4.6 Usage in Other Modules

```typescript
// In AuthService, UserService, etc.
@Injectable()
export class AuthService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcomeEmail(user: User): Promise<void> {
    await this.emailService.send({
      to: user.email,
      subject: 'Welcome to the platform!',
      html: WelcomeTemplate.render({ name: user.name }),
    });
  }
}
```

---

### 4.7 Cache Invalidation on Config Update

When admin saves new SMTP config via your config page:

```typescript
// In your email config controller/service
async updateSmtpConfig(dto: UpdateSmtpConfigDto): Promise<void> {
  await this.emailConfigRepo.save(dto);
  this.smtpConfigService.invalidateCache(); // ← bust cache immediately
}
```

---

## 5. Resend via SMTP Bridge

Your existing config page works as-is with Resend. Just fill in:

| Field          | Value                        |
|----------------|------------------------------|
| SMTP Host      | `smtp.resend.com`            |
| SMTP Port      | `465`                        |
| SMTP Username  | `resend`                     |
| SMTP Password  | `re_xxxxxxxxxxxx` (API key)  |
| From Address   | `noreply@yourdomain.com`     |
| From Name      | Your App Name                |

> For **staging**, use `onboarding@resend.dev` as the From Address
> (no domain verification needed, works immediately after signup)

**Zero code change required** — Resend SMTP is just another SMTP config entry in your DB.

---

## 6. Email Templates

### Base Template — `base.template.ts`

```typescript
export class BaseTemplate {
  static wrap(content: string, appName = 'Your App'): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">
            <h2 style="color: #333;">${appName}</h2>
          </div>
          ${content}
          <div style="border-top: 2px solid #eee; margin-top: 20px; padding-top: 10px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} ${appName}
          </div>
        </body>
      </html>
    `;
  }
}
```

### Example Template — `welcome.template.ts`

```typescript
import { BaseTemplate } from './base.template';

export class WelcomeTemplate {
  static render(data: { name: string }): string {
    return BaseTemplate.wrap(`
      <h3>Welcome, ${data.name}!</h3>
      <p>Your account has been created successfully.</p>
    `);
  }
}
```

---

## 7. Error Handling & Retry

The `EmailService.send()` already implements retry with exponential back-off (see §4.4).

**Additional recommendations:**

```typescript
// Don't crash the request if email fails for non-critical emails
// (e.g., welcome email — user is already registered)
async register(dto: RegisterDto) {
  const user = await this.userService.create(dto);

  // Fire and forget for non-critical
  this.emailService.send({ ... }).catch(err =>
    this.logger.error('Welcome email failed silently', err)
  );

  return user;
}

// Throw for critical emails (e.g., password reset — must succeed)
async requestPasswordReset(email: string) {
  const token = await this.generateResetToken(email);
  await this.emailService.send({ ... }); // let it throw if it fails
  return { message: 'Reset email sent' };
}
```

---

## 8. Future: BullMQ Migration Path

When you're ready to add queuing (volume growth, scheduled sends), the migration is minimal:

**Step 1:** Install BullMQ + Redis:
```bash
npm install bullmq @nestjs/bullmq ioredis
```

**Step 2:** Create `EmailQueue` that wraps `EmailService`:
```typescript
@Processor('email')
export class EmailProcessor {
  constructor(private readonly emailService: EmailService) {}

  @Process()
  async handle(job: Job<SendEmailOptions>): Promise<void> {
    await this.emailService.send(job.data);
  }
}
```

**Step 3:** Replace direct `emailService.send()` calls with `emailQueue.add()` in callers.

> `EmailService` itself doesn't change — only the callers switch from direct call to queue.
> This is why the facade pattern matters.

**Trigger migration when:**
- Volume exceeds ~1,000 emails/day
- You need scheduled/delayed sends
- You need a visual job dashboard (Bull Board)
- Email failures are causing request failures you can't fire-and-forget

---

## 9. Environment Variables

```env
# Fallback SMTP config (used if no active DB config found)
# Useful for local dev without DB
FALLBACK_SMTP_HOST=smtp.resend.com
FALLBACK_SMTP_PORT=465
FALLBACK_SMTP_USER=resend
FALLBACK_SMTP_PASS=re_your_api_key_here
FALLBACK_FROM_ADDRESS=onboarding@resend.dev
FALLBACK_FROM_NAME=MyApp Dev
```

---

## 10. Testing Checklist

- [ ] SMTP config saved in DB via admin config page
- [ ] `SmtpConfigService.getActiveConfig()` returns correct config
- [ ] Config cache invalidated after admin update
- [ ] `EmailService.send()` delivers email via Resend SMTP bridge
- [ ] `verifyConnection()` endpoint returns `true` (add a test button to your config page)
- [ ] Retry logic fires on transient SMTP failure (test with wrong password then fix)
- [ ] Welcome email fires on registration (fire-and-forget)
- [ ] Password reset email throws on failure (critical path)
- [ ] Switching provider = only DB config change, no code change
- [ ] Staging uses `onboarding@resend.dev` sender, production uses verified domain
