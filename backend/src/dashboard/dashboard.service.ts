import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity.js';
import { Department } from '../database/entities/department.entity.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(CarRequest)
    private requestsRepository: Repository<CarRequest>,
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  async getSummary() {
    const [
      totalRequests,
      pendingRequests,
      completedRequests,
      onHoldRequests,
      departments,
    ] = await Promise.all([
      this.requestsRepository.count(),
      this.requestsRepository.count({ where: { status: RequestStatus.PENDING } }),
      this.requestsRepository.count({ where: { status: RequestStatus.COMPLETED } }),
      this.requestsRepository.count({ where: { status: RequestStatus.ON_HOLD } }),
      this.departmentsRepository.find({ order: { pipelineOrder: 'ASC' } }),
    ]);

    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        const [pending, completed] = await Promise.all([
          this.requestsRepository.count({
            where: { status: RequestStatus.PENDING },
          }),
          this.requestsRepository.count({
            where: { status: RequestStatus.COMPLETED },
          }),
        ]);
        return {
          id: dept.id,
          name: dept.name,
          slug: dept.slug,
          pipelineOrder: dept.pipelineOrder,
          pending,
          completed,
        };
      }),
    );

    return {
      totalRequests,
      pendingRequests,
      completedRequests,
      onHoldRequests,
      departmentStats,
    };
  }
}
