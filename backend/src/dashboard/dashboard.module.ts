import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { CarRequest } from '../database/entities/car-request.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CarRequest, Department, RequestStageTransition])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
