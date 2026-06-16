import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity';
import { Department } from '../database/entities/department.entity';
import { RequestStageTransition, TransitionAction } from '../database/entities/request-stage-transition.entity';
import { PipelineStageResolverService } from '../requests/pipeline-stage-resolver.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockRequestsRepo: any;
  let mockDepartmentsRepo: any;
  let mockTransitionsRepo: any;

  const mockDepartments = [
    { id: 1, name: 'Storage', slug: 'storage', pipelineOrder: 1, isActive: true },
    { id: 2, name: 'PDI', slug: 'pdi', pipelineOrder: 2, isActive: true },
  ];

  const createMockQb = (overrides: Record<string, any> = {}) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getCount: jest.fn(),
    getQuery: jest.fn().mockReturnValue('SELECT 1'),
    getParameters: jest.fn().mockReturnValue({}),
    setParameters: jest.fn().mockReturnThis(),
    ...overrides,
  });

  beforeEach(async () => {
    mockRequestsRepo = {
      count: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockDepartmentsRepo = {
      find: jest.fn(),
    };

    mockTransitionsRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(CarRequest), useValue: mockRequestsRepo },
        { provide: getRepositoryToken(Department), useValue: mockDepartmentsRepo },
        {
          provide: getRepositoryToken(RequestStageTransition),
          useValue: mockTransitionsRepo,
        },
        {
          provide: PipelineStageResolverService,
          useValue: { resolveCurrentStage: jest.fn(), getApplicableStages: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getStats', () => {
    it('should return daily stats with correct counts', async () => {
      mockRequestsRepo.count
        .mockResolvedValueOnce(50)   // totalRequests today
        .mockResolvedValueOnce(10)   // completedRequests today
        .mockResolvedValueOnce(40)   // prev totalRequests yesterday
        .mockResolvedValueOnce(5);   // prev completedRequests yesterday

      const result = await service.getStats('daily');

      expect(result).toEqual({
        totalRequests: 50,
        completedRequests: 10,
        completionRate: 20.0,
        trend: 25.0,
      });
      expect(mockRequestsRepo.count).toHaveBeenCalledTimes(4);
    });

    it('should return monthly stats with correct counts', async () => {
      mockRequestsRepo.count
        .mockResolvedValueOnce(200)  // totalRequests this month
        .mockResolvedValueOnce(40)   // completedRequests this month
        .mockResolvedValueOnce(180)  // prev totalRequests last month
        .mockResolvedValueOnce(30);  // prev completedRequests last month

      const result = await service.getStats('monthly');

      expect(result).toEqual({
        totalRequests: 200,
        completedRequests: 40,
        completionRate: 20.0,
        trend: 11.1,
      });
    });

    it('should handle zero previous period gracefully', async () => {
      mockRequestsRepo.count
        .mockResolvedValueOnce(10)   // totalRequests
        .mockResolvedValueOnce(2)    // completedRequests
        .mockResolvedValueOnce(0)    // prev totalRequests
        .mockResolvedValueOnce(0);   // prev completedRequests

      const result = await service.getStats('daily');

      expect(result.trend).toBe(100);
      expect(result.completionRate).toBe(20.0);
    });

    it('should handle zero total requests gracefully', async () => {
      mockRequestsRepo.count
        .mockResolvedValueOnce(0)  // totalRequests
        .mockResolvedValueOnce(0)  // completedRequests
        .mockResolvedValueOnce(0)  // prev totalRequests
        .mockResolvedValueOnce(0); // prev completedRequests

      const result = await service.getStats('daily');

      expect(result.totalRequests).toBe(0);
      expect(result.completedRequests).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.trend).toBe(0);
    });
  });

  describe('getComparison', () => {
    it('should return daily breakdown for the given month', async () => {
      // Use a month with known day count
      const currentRows = [
        { day: 1, count: '5' },
        { day: 15, count: '3' },
      ];
      const prevRows = [
        { day: 1, count: '2' },
        { day: 20, count: '7' },
      ];

      // The first createQueryBuilder call creates the "current" QB, the second the "prev" QB
      const currentQb = createMockQb({ getRawMany: jest.fn().mockResolvedValue(currentRows) });
      const prevQb = createMockQb({ getRawMany: jest.fn().mockResolvedValue(prevRows) });

      mockRequestsRepo.createQueryBuilder
        .mockReturnValueOnce(currentQb)
        .mockReturnValueOnce(prevQb);

      const result = await service.getComparison('2026-06');

      // June has 30 days
      expect(result.days).toHaveLength(30);
      expect(result.days[0]).toEqual({ day: 1, currentMonth: 5, previousMonth: 2 });
      expect(result.days[14]).toEqual({ day: 15, currentMonth: 3, previousMonth: 0 });
      expect(result.days[19]).toEqual({ day: 20, currentMonth: 0, previousMonth: 7 });
      // A day with no data in either month
      expect(result.days[4]).toEqual({ day: 5, currentMonth: 0, previousMonth: 0 });
    });

    it('should use current month when no month argument provided', async () => {
      const now = new Date();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const expectedMonth = `${now.getFullYear()}-${currentMonth}`;

      const qb = createMockQb({ getRawMany: jest.fn().mockResolvedValue([]) });
      mockRequestsRepo.createQueryBuilder
        .mockReturnValueOnce(qb)
        .mockReturnValueOnce(qb);

      const result = await service.getComparison();

      // Should have returned days for the current month
      expect(result.days.length).toBeGreaterThan(0);
    });
  });

  describe('getPipelineSummary', () => {
    it('should return correct request counts per department', async () => {
      mockDepartmentsRepo.find.mockResolvedValue(mockDepartments);

      // For department 1: subquery-based count returns 3
      // For department 2: subquery-based count returns 1
      const startedQb1 = createMockQb({ getQuery: jest.fn().mockReturnValue('SELECT t.requestId FROM request_stage_transitions t WHERE t.department_id = 1 AND t.action = \'started\'') });
      const completedQb1 = createMockQb({ getQuery: jest.fn().mockReturnValue('SELECT t2.requestId FROM request_stage_transitions t2 WHERE t2.department_id = 1 AND t2.action = \'completed\'') });
      const countQb1 = createMockQb({ getCount: jest.fn().mockResolvedValue(3) });

      const startedQb2 = createMockQb({ getQuery: jest.fn().mockReturnValue('SELECT t.requestId FROM request_stage_transitions t WHERE t.department_id = 2 AND t.action = \'started\'') });
      const completedQb2 = createMockQb({ getQuery: jest.fn().mockReturnValue('SELECT t2.requestId FROM request_stage_transitions t2 WHERE t2.department_id = 2 AND t2.action = \'completed\'') });
      const countQb2 = createMockQb({ getCount: jest.fn().mockResolvedValue(1) });

      // First department: 3 calls to createQueryBuilder (started, completed, count)
      // Second department: 3 calls
      mockTransitionsRepo.createQueryBuilder
        .mockReturnValueOnce(startedQb1)
        .mockReturnValueOnce(completedQb1)
        .mockReturnValueOnce(countQb1)
        .mockReturnValueOnce(startedQb2)
        .mockReturnValueOnce(completedQb2)
        .mockReturnValueOnce(countQb2);

      const result = await service.getPipelineSummary();

      expect(result.stages).toHaveLength(2);
      expect(result.stages[0]).toEqual({
        departmentId: 1,
        departmentName: 'Storage',
        slug: 'storage',
        pipelineOrder: 1,
        count: 3,
      });
      expect(result.stages[1]).toEqual({
        departmentId: 2,
        departmentName: 'PDI',
        slug: 'pdi',
        pipelineOrder: 2,
        count: 1,
      });
    });

    it('should return empty stages when no departments exist', async () => {
      mockDepartmentsRepo.find.mockResolvedValue([]);

      const result = await service.getPipelineSummary();

      expect(result.stages).toEqual([]);
    });
  });
});
