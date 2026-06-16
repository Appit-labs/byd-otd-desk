import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { StageTransitionsService } from './stage-transitions.service.js';
import { PipelineStageResolverService } from './pipeline-stage-resolver.service.js';
import { CarRequest } from '../database/entities/car-request.entity.js';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { Setting } from '../database/entities/setting.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CarRequest, RequestStageTransition, Department, Setting, SettingOption]),
    EmailModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService, StageTransitionsService, PipelineStageResolverService],
  exports: [RequestsService, StageTransitionsService, PipelineStageResolverService],
})
export class RequestsModule {}
