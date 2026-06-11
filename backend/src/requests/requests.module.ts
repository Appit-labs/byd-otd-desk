import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { CarRequest } from '../database/entities/car-request.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CarRequest])],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
