import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get dashboard stats for a given period' })
  @ApiQuery({
    name: 'period',
    enum: ['daily', 'monthly'],
    required: false,
    description: 'Period for stats aggregation',
  })
  async getStats(@Query('period') period: 'daily' | 'monthly' = 'daily') {
    return this.dashboardService.getStats(period);
  }

  @Get('comparison')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get daily comparison between current and previous month' })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Month in YYYY-MM format (defaults to current month)',
  })
  async getComparison(@Query('month') month?: string) {
    return this.dashboardService.getComparison(month);
  }

  @Get('pipeline-summary')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get request count per pipeline stage' })
  async getPipelineSummary() {
    return this.dashboardService.getPipelineSummary();
  }
}
