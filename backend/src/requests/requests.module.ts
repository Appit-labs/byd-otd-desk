import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { StageTransitionsService } from './stage-transitions.service.js';
import { CarRequest } from '../database/entities/car-request.entity.js';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity.js';
import { Department } from '../database/entities/department.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CarRequest, RequestStageTransition, Department]),
  ],
  controllers: [RequestsController],
  providers: [RequestsService, StageTransitionsService],
  exports: [RequestsService, StageTransitionsService],
})
export class RequestsModule {}
