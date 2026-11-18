import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { EmailService } from './email.service.js';
import { UpdateEmailConfigDto } from './dto/update-email-config.dto.js';

@ApiTags('Email')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'email', version: '1' })
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('config')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get current email configuration (password masked)' })
  async getConfig() {
    return this.emailService.getConfig();
  }

  @Put('config')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update email configuration' })
  async updateConfig(@Body() dto: UpdateEmailConfigDto) {
    return this.emailService.updateConfig(dto);
  }

  @Post('config/verify')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Verify SMTP connection' })
  async verifyConfig() {
    return this.emailService.verifyConnection();
  }

  @Get('notifications')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get notification log (paginated)' })
  async getNotificationLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.emailService.getNotificationLog(pageNum, limitNum, status);
  }

  @Post('test')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Send a test email' })
  async sendTest(
    @CurrentUser('email') currentUserEmail: string,
    @Body('to') toEmail?: string,
  ) {
    const recipient = toEmail?.trim() || currentUserEmail;
    if (!recipient) {
      throw new BadRequestException('No recipient email address provided');
    }
    return this.emailService.sendTestEmail(recipient);
  }

  @Post('debug/notify')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: '[DEBUG] Trigger a notification for a specific event and request' })
  async debugNotify(
    @Body('event') event: string,
    @Body('requestId') requestId: number,
    @Body('to') toEmail?: string,
  ) {
    if (!event || !requestId) {
      throw new BadRequestException('event and requestId are required');
    }
    return this.emailService.debugTriggerNotification(event, requestId, toEmail);
  }
}
