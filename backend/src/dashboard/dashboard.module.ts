import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { CarRequest } from '../database/entities/car-request.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity.js';
import { Setting } from '../database/entities/setting.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';
import { PipelineStageResolverService } from '../requests/pipeline-stage-resolver.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CarRequest, Department, RequestStageTransition, Setting, SettingOption])],
  controllers: [DashboardController],
  providers: [DashboardService, PipelineStageResolverService],
  exports: [DashboardService],
})
export class DashboardModule {}
