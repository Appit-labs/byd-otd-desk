import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { CarRequest } from '../database/entities/car-request.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CarRequest])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
