import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ReportsService, SEVEN_DAYS_SECONDS } from './reports.service.js';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get summary stats for Reports page' })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Month in YYYY-MM format (defaults to current month)',
  })
  async getSummary(@Query('month') month?: string) {
    const summary = await this.reportsService.getSummary(month);
    return {
      ...summary,
      pdiTargetSeconds: SEVEN_DAYS_SECONDS,
      accessoriesTargetSeconds: SEVEN_DAYS_SECONDS,
    };
  }

  @Get('pdi-avg-duration')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Average PDI completion time per month/day' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['monthly', 'daily'],
    description: 'Grouping period (default: monthly)',
  })
  async getPdiAvgDuration(
    @Query('period') period: 'monthly' | 'daily' = 'monthly',
  ) {
    const data = await this.reportsService.getPdiAvgDuration(period);
    return {
      data,
      targetSeconds: SEVEN_DAYS_SECONDS,
    };
  }

  @Get('accessories-avg-duration')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Average Accessories completion time per month/day' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['monthly', 'daily'],
    description: 'Grouping period (default: monthly)',
  })
  async getAccessoriesAvgDuration(
    @Query('period') period: 'monthly' | 'daily' = 'monthly',
  ) {
    const data = await this.reportsService.getAccessoriesAvgDuration(period);
    return {
      data,
      targetSeconds: SEVEN_DAYS_SECONDS,
    };
  }

  @Get('requests-by-brand')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Request counts grouped by brand and period' })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['monthly', 'daily'],
    description: 'Time granularity (default: monthly)',
  })
  async getRequestsByBrand(
    @Query('granularity') granularity: 'monthly' | 'daily' = 'monthly',
  ) {
    return this.reportsService.getRequestsByBrand(granularity);
  }

  @Get('requests-by-type')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Request counts grouped by request type' })
  async getRequestsByType() {
    return this.reportsService.getRequestsByType();
  }

  @Get('requests-by-model')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Request counts grouped by vehicle model' })
  async getRequestsByModel() {
    return this.reportsService.getRequestsByModel();
  }

  @Get('requests-by-consultant')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Request counts grouped by sales consultant' })
  async getRequestsByConsultant() {
    return this.reportsService.getRequestsByConsultant();
  }
}
