import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, IsNull } from 'typeorm';
import {
  CarRequest,
  RequestStatus,
  PipelineStage,
} from '../database/entities/car-request.entity.js';
import { Department } from '../database/entities/department.entity.js';
import {
  RequestStageTransition,
  TransitionAction,
} from '../database/entities/request-stage-transition.entity.js';
import { PipelineStageResolverService } from '../requests/pipeline-stage-resolver.service.js';

export interface StatsResult {
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
  trend: number;
  pendingActions: number;
}

export interface ComparisonDay {
  day: number;
  currentMonth: number;
  previousMonth: number;
}

interface PipelineStageStat {
  departmentId: number;
  departmentName: string;
  slug: string;
  pipelineOrder: number;
  count: number;
}

export interface PipelineSummaryResult {
  stages: PipelineStageStat[];
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
    private pipelineStageResolver: PipelineStageResolverService,
  ) {}

  async getSummary() {
    const activeStatuses = [RequestStatus.ACTIVE];
    const archivedStatuses = [
      RequestStatus.ARCHIVED_MANUAL,
      RequestStatus.ARCHIVED_QC,
    ];

    const [
      totalRequests,
      activeRequests,
      deliveredRequests,
      cancelledRequests,
      archivedRequests,
      departments,
    ] = await Promise.all([
      this.requestsRepository.count(),
      this.requestsRepository.count({ where: { status: RequestStatus.ACTIVE } }),
      // Delivered = all timestamps filled (delivered_at is not null)
      this.requestsRepository.count({
        where: { status: RequestStatus.ACTIVE, deliveredAt: Not(IsNull()) },
      }),
      this.requestsRepository.count({ where: { status: RequestStatus.CANCELLED } }),
      this.requestsRepository.count({
        where: { status: In(archivedStatuses) },
      }),
      this.departmentsRepository.find({ order: { pipelineOrder: 'ASC' } }),
    ]);

    const departmentStats = await this.getDepartmentStats(departments);

    return {
      totalRequests,
      activeRequests,
      deliveredRequests,
      cancelledRequests,
      archivedRequests,
      departmentStats,
    };
  }

  async getStats(period: 'daily' | 'monthly', userRole?: string): Promise<StatsResult> {
    const now = new Date();
    const { start, end, prevStart, prevEnd } = this.getPeriodRange(now, period);

    // "Completed" = delivered (delivered_at is set)
    const [totalRequests, completedRequests, prevTotalRequests, prevCompletedRequests] =
      await Promise.all([
        this.requestsRepository.count({
          where: { createdAt: Between(start, end) },
        }),
        this.requestsRepository.count({
          where: {
            deliveredAt: Between(start, end),
          },
        }),
        this.requestsRepository.count({
          where: { createdAt: Between(prevStart, prevEnd) },
        }),
        this.requestsRepository.count({
          where: {
            deliveredAt: Between(prevStart, prevEnd),
          },
        }),
      ]);

    const completionRate =
      totalRequests > 0
        ? parseFloat(((completedRequests / totalRequests) * 100).toFixed(1))
        : 0;

    const trend =
      prevTotalRequests > 0
        ? parseFloat(
            (((totalRequests - prevTotalRequests) / prevTotalRequests) * 100).toFixed(1),
          )
        : totalRequests > 0
          ? 100
          : 0;

    // Count pending actions for the user's role
    let pendingActions = 0;
    if (userRole && userRole !== 'super_admin' && userRole !== 'admin' && userRole !== 'viewer') {
      const activeRequests = await this.requestsRepository.find({
        where: { status: RequestStatus.ACTIVE },
        relations: ['requestType'],
      });
      pendingActions = activeRequests.filter((req) => {
        const current = this.pipelineStageResolver.resolveCurrentStage(req);
        if (!current) return false;
        return this.pipelineStageResolver.isRoleAuthorizedForStage(userRole, current.stage);
      }).length;
    }

    return {
      totalRequests,
      completedRequests,
      completionRate,
      trend,
      pendingActions,
    };
  }

  async getComparison(month?: string): Promise<{ days: ComparisonDay[] }> {
    const targetMonth = month ?? this.formatMonth(new Date());
    const [year, mon] = targetMonth.split('-').map(Number);

    const currentStart = new Date(year, mon - 1, 1);
    const currentEnd = new Date(year, mon, 0, 23, 59, 59, 999);

    const prevStart = new Date(year, mon - 2, 1);
    const prevEnd = new Date(year, mon - 1, 0, 23, 59, 59, 999);

    const daysInMonth = currentEnd.getDate();

    const currentRows = await this.requestsRepository
      .createQueryBuilder('r')
      .select('DAY(r.created_at)', 'day')
      .addSelect('COUNT(*)', 'count')
      .where('r.created_at >= :start', { start: currentStart })
      .andWhere('r.created_at <= :end', { end: currentEnd })
      .groupBy('DAY(r.created_at)')
      .orderBy('DAY(r.created_at)', 'ASC')
      .getRawMany<{ day: number; count: string }>();

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
    const departments = await this.departmentsRepository.find({
      order: { pipelineOrder: 'ASC' },
    });

    // Map department slugs → which PipelineStage(s) they represent
    const DEPT_TO_STAGES: Record<string, PipelineStage[]> = {
      storage: [PipelineStage.CREATED, PipelineStage.STORAGE, PipelineStage.SHOWROOM],
      mechanical_check: [PipelineStage.MECHANICAL_CHECK],
      pdi: [PipelineStage.PDI],
      accessories: [PipelineStage.SENT_TO_ACCESSORIES, PipelineStage.ACCESSORIES],
      final_inspection: [PipelineStage.FINAL_INSPECTION],
      gps: [PipelineStage.GPS],
      registration: [PipelineStage.REGISTRATION],
      delivery: [PipelineStage.DELIVERY],
    };

    const allRequests = await this.requestsRepository.find();
    const activeRequests = allRequests.filter(r => r.status !== RequestStatus.CANCELLED);

    // Resolve each request to its current pipeline stage.
    // Fully-completed requests (resolveCurrentStage returns null) go to a
    // synthetic "completed" bucket, not to Delivery.
    const stageCounts = new Map<PipelineStage, number>();
    let completedCount = 0;
    for (const req of activeRequests) {
      const current = this.pipelineStageResolver.resolveCurrentStage(req);
      if (current) {
        stageCounts.set(current.stage, (stageCounts.get(current.stage) ?? 0) + 1);
      } else {
        completedCount++;
      }
    }
    const stages: PipelineStageStat[] = departments.map((dept) => {
      const mappedStages = DEPT_TO_STAGES[dept.slug] ?? [];
      const count = mappedStages.reduce((sum, stage) => sum + (stageCounts.get(stage) ?? 0), 0);

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        slug: dept.slug,
        pipelineOrder: dept.pipelineOrder,
        count,
      };
    });

    // Append a synthetic "Completed" entry for requests that finished all stages
    stages.push({
      departmentId: 0,
      departmentName: 'Completed',
      slug: 'completed',
      pipelineOrder: stages.length + 1,
      count: completedCount,
    });

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
    const month = now.getMonth();
    const day = now.getDate();

    if (period === 'daily') {
      const start = new Date(year, month, day, 0, 0, 0, 0);
      const end = new Date(year, month, day, 23, 59, 59, 999);
      const prevStart = new Date(year, month, day - 1, 0, 0, 0, 0);
      const prevEnd = new Date(year, month, day - 1, 23, 59, 59, 999);
      return { start, end, prevStart, prevEnd };
    }

    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
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
