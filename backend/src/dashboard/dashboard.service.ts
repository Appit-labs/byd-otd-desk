import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { RequestStageTransition, TransitionAction } from '../database/entities/request-stage-transition.entity.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(CarRequest)
    private requestsRepository: Repository<CarRequest>,
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
    @InjectRepository(RequestStageTransition)
    private transitionsRepository: Repository<RequestStageTransition>,
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

    // Aggregate per-department counts from request_stage_transitions
    // A request is "pending" in a department if it has been started there but not completed
    // A request is "completed" in a department if it has a completed transition there
    const departmentStats = await this.getDepartmentStats(departments);

    return {
      totalRequests,
      pendingRequests,
      completedRequests,
      onHoldRequests,
      departmentStats,
    };
  }

  private async getDepartmentStats(
    departments: Department[],
  ): Promise<
    Array<{
      id: number;
      name: string;
      slug: string;
      pipelineOrder: number;
      pending: number;
      completed: number;
    }>
  > {
    // Single aggregate query: for each department, count started vs completed transitions
    const rawStats = await this.transitionsRepository
      .createQueryBuilder('t')
      .select('t.department_id', 'departmentId')
      .addSelect(
        `COUNT(DISTINCT CASE WHEN t.action = '${TransitionAction.STARTED}' THEN t.request_id END)`,
        'pending',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN t.action = '${TransitionAction.COMPLETED}' THEN t.request_id END)`,
        'completed',
      )
      .groupBy('t.department_id')
      .getRawMany<{ departmentId: number; pending: string; completed: string }>();

    const statsMap = new Map<number, { pending: number; completed: number }>();
    for (const row of rawStats) {
      statsMap.set(row.departmentId, {
        pending: parseInt(row.pending, 10) || 0,
        completed: parseInt(row.completed, 10) || 0,
      });
    }

    return departments.map((dept) => {
      const stats = statsMap.get(dept.id) ?? { pending: 0, completed: 0 };
      return {
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        pipelineOrder: dept.pipelineOrder,
        pending: stats.pending,
        completed: stats.completed,
      };
    });
  }
}
