import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { RequestStageTransition, TransitionAction } from '../database/entities/request-stage-transition.entity.js';

export interface StatsResult {
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
  trend: number;
}

export interface ComparisonDay {
  day: number;
  currentMonth: number;
  previousMonth: number;
}

interface PipelineStage {
  departmentId: number;
  departmentName: string;
  slug: string;
  pipelineOrder: number;
  count: number;
}

export interface PipelineSummaryResult {
  stages: PipelineStage[];
}

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

  async getStats(period: 'daily' | 'monthly'): Promise<StatsResult> {
    const now = new Date();
    const { start, end, prevStart, prevEnd } = this.getPeriodRange(now, period);

    const [totalRequests, completedRequests, prevTotalRequests, prevCompletedRequests] =
      await Promise.all([
        this.requestsRepository.count({
          where: { createdAt: Between(start, end) },
        }),
        this.requestsRepository.count({
          where: {
            status: RequestStatus.COMPLETED,
            completedAt: Between(start, end),
          },
        }),
        this.requestsRepository.count({
          where: { createdAt: Between(prevStart, prevEnd) },
        }),
        this.requestsRepository.count({
          where: {
            status: RequestStatus.COMPLETED,
            completedAt: Between(prevStart, prevEnd),
          },
        }),
      ]);

    const completionRate = totalRequests > 0
      ? parseFloat(((completedRequests / totalRequests) * 100).toFixed(1))
      : 0;

    const trend = prevTotalRequests > 0
      ? parseFloat((((totalRequests - prevTotalRequests) / prevTotalRequests) * 100).toFixed(1))
      : totalRequests > 0 ? 100 : 0;

    return {
      totalRequests,
      completedRequests,
      completionRate,
      trend,
    };
  }

  async getComparison(month?: string): Promise<{ days: ComparisonDay[] }> {
    const targetMonth = month ?? this.formatMonth(new Date());
    const [year, mon] = targetMonth.split('-').map(Number);

    // Current month range
    const currentStart = new Date(year, mon - 1, 1);
    const currentEnd = new Date(year, mon, 0, 23, 59, 59, 999);

    // Previous month range
    const prevStart = new Date(year, mon - 2, 1);
    const prevEnd = new Date(year, mon - 1, 0, 23, 59, 59, 999);

    const daysInMonth = currentEnd.getDate();

    // Fetch current month counts per day
    const currentRows = await this.requestsRepository
      .createQueryBuilder('r')
      .select('DAY(r.created_at)', 'day')
      .addSelect('COUNT(*)', 'count')
      .where('r.created_at >= :start', { start: currentStart })
      .andWhere('r.created_at <= :end', { end: currentEnd })
      .groupBy('DAY(r.created_at)')
      .orderBy('DAY(r.created_at)', 'ASC')
      .getRawMany<{ day: number; count: string }>();

    // Fetch previous month counts per day
    const prevRows = await this.requestsRepository
      .createQueryBuilder('r')
      .select('DAY(r.created_at)', 'day')
      .addSelect('COUNT(*)', 'count')
      .where('r.created_at >= :start', { start: prevStart })
      .andWhere('r.created_at <= :end', { end: prevEnd })
      .groupBy('DAY(r.created_at)')
      .orderBy('DAY(r.created_at)', 'ASC')
      .getRawMany<{ day: number; count: string }>();

    const currentMap = new Map<number, number>();
    for (const row of currentRows) {
      currentMap.set(row.day, parseInt(row.count, 10) || 0);
    }

    const prevMap = new Map<number, number>();
    for (const row of prevRows) {
      prevMap.set(row.day, parseInt(row.count, 10) || 0);
    }

    const days: ComparisonDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        currentMonth: currentMap.get(d) ?? 0,
        previousMonth: prevMap.get(d) ?? 0,
      });
    }

    return { days };
  }

  async getPipelineSummary(): Promise<PipelineSummaryResult> {
    // For each department, find requests that have a "started" transition
    // but no "completed" transition in that department
    const departments = await this.departmentsRepository.find({
      order: { pipelineOrder: 'ASC' },
    });

    const stages: PipelineStage[] = await Promise.all(
      departments.map(async (dept) => {
        // Subquery: requests that have a started transition for this department
        const startedQb = this.transitionsRepository
          .createQueryBuilder('t')
          .select('t.requestId')
          .where('t.department_id = :deptId', { deptId: dept.id })
          .andWhere('t.action = :started', { started: TransitionAction.STARTED });

        // Subquery: requests that have a completed transition for this department
        const completedQb = this.transitionsRepository
          .createQueryBuilder('t2')
          .select('t2.requestId')
          .where('t2.department_id = :deptId2', { deptId2: dept.id })
          .andWhere('t2.action = :completed', { completed: TransitionAction.COMPLETED });

        // Count requests started but not completed in this department
        const count = await this.transitionsRepository
          .createQueryBuilder('t3')
          .where(`t3.request_id IN (${startedQb.getQuery()})`)
          .andWhere(`t3.request_id NOT IN (${completedQb.getQuery()})`)
          .andWhere('t3.department_id = :deptId3', { deptId3: dept.id })
          .setParameters(startedQb.getParameters())
          .setParameters(completedQb.getParameters())
          .getCount();

        return {
          departmentId: dept.id,
          departmentName: dept.name,
          slug: dept.slug,
          pipelineOrder: dept.pipelineOrder,
          count,
        };
      }),
    );

    return { stages };
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

  private getPeriodRange(
    now: Date,
    period: 'daily' | 'monthly',
  ): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const day = now.getDate();

    if (period === 'daily') {
      // Today: 00:00:00 to 23:59:59.999
      const start = new Date(year, month, day, 0, 0, 0, 0);
      const end = new Date(year, month, day, 23, 59, 59, 999);
      // Yesterday
      const prevStart = new Date(year, month, day - 1, 0, 0, 0, 0);
      const prevEnd = new Date(year, month, day - 1, 23, 59, 59, 999);
      return { start, end, prevStart, prevEnd };
    }

    // Monthly: current month
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    // Previous month
    const prevStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end, prevStart, prevEnd };
  }

  private formatMonth(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
