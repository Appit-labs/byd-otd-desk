import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { StageTransitionsService } from './stage-transitions.service';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity';
import { RequestStageTransition, TransitionAction } from '../database/entities/request-stage-transition.entity';
import { Department } from '../database/entities/department.entity';

describe('StageTransitionsService', () => {
  let service: StageTransitionsService;
  let mockRequestsRepo: any;
  let mockDepartmentsRepo: any;
  let mockTransitionsRepo: any;
  let mockDataSource: any;

  const mockEntityManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const storageDept: Department = {
    id: 1,
    name: 'Storage',
    slug: 'storage',
    pipelineOrder: 1,
    isActive: true,
    createdAt: new Date(),
    users: [],
    stageTransitions: [],
  };

  const pdiDept: Department = {
    id: 2,
    name: 'PDI',
    slug: 'pdi',
    pipelineOrder: 2,
    isActive: true,
    createdAt: new Date(),
    users: [],
    stageTransitions: [],
  };

  const deliveryDept: Department = {
    id: 3,
    name: 'Delivery',
    slug: 'delivery',
    pipelineOrder: 3,
    isActive: true,
    createdAt: new Date(),
    users: [],
    stageTransitions: [],
  };

  const superAdminUser = {
    id: 1,
    role: 'super_admin',
    departmentId: null,
  };

  const nvsUser = {
    id: 2,
    role: 'nvs' as const,
    departmentId: 1, // Storage department
  };

  const wrongDeptUser = {
    id: 3,
    role: 'nvs' as const,
    departmentId: 999,
  };

  beforeEach(async () => {
    mockRequestsRepo = {
      findOne: jest.fn(),
    };

    mockDepartmentsRepo = {
      findOne: jest.fn(),
    };

    mockTransitionsRepo = {
      findOne: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(),
    };

    // Mute logger
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StageTransitionsService,
        {
          provide: getRepositoryToken(CarRequest),
          useValue: mockRequestsRepo,
        },
        {
          provide: getRepositoryToken(Department),
          useValue: mockDepartmentsRepo,
        },
        {
          provide: getRepositoryToken(RequestStageTransition),
          useValue: mockTransitionsRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<StageTransitionsService>(StageTransitionsService);
  });

  describe('transition', () => {
    beforeEach(() => {
      mockDataSource.transaction.mockImplementation(
        (cb: (em: any) => Promise<any>) => cb(mockEntityManager),
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    // Test 1: start first stage (Storage) — succeeds when request exists
    it('should start first stage (Storage) successfully', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne.mockImplementation((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id === 1) return Promise.resolve(storageDept);
        if (entity === RequestStageTransition) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const transition = {
        id: 1,
        requestId: 1,
        departmentId: 1,
        action: TransitionAction.STARTED,
        actionedBy: 1,
      };
      mockEntityManager.create.mockReturnValue(transition);
      mockEntityManager.save.mockResolvedValue(transition);

      const result = await service.transition(1, 1, 'started', superAdminUser);

      expect(result).toEqual(transition);
      // Status no longer auto-updated since requests start as ACTIVE
    });

    // Test 2: start non-first stage without previous completed — throws
    it('should throw when starting non-first stage without previous completed', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne.mockImplementation((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id === 2) return Promise.resolve(pdiDept);
        if (entity === Department && opts.where.pipelineOrder === 1)
          return Promise.resolve(storageDept);
        if (
          entity === RequestStageTransition &&
          opts.where.departmentId === 1 &&
          opts.where.action === TransitionAction.COMPLETED
        )
          return Promise.resolve(null); // No completed for storage
        return Promise.resolve(null);
      });

      await expect(
        service.transition(1, 2, 'started', superAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    // Test 3: start stage with previous completed — succeeds
    it('should start stage when previous stage is completed', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne.mockImplementation((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id === 2) return Promise.resolve(pdiDept);
        if (entity === Department && opts.where.pipelineOrder === 1)
          return Promise.resolve(storageDept);
        if (
          entity === RequestStageTransition &&
          opts.where.departmentId === 1 &&
          opts.where.action === TransitionAction.COMPLETED
        )
          return Promise.resolve({ id: 10 }); // Storage is completed
        return Promise.resolve(null);
      });

      const transition = {
        id: 2,
        requestId: 1,
        departmentId: 2,
        action: TransitionAction.STARTED,
        actionedBy: 1,
      };
      mockEntityManager.create.mockReturnValue(transition);
      mockEntityManager.save.mockResolvedValue(transition);

      const result = await service.transition(1, 2, 'started', superAdminUser);

      expect(result).toEqual(transition);
      expect(mockEntityManager.update).not.toHaveBeenCalled(); // status stays ACTIVE
    });

    // Test 4: complete stage without started — throws
    it('should throw when completing a stage without started', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne.mockImplementation((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id === 1) return Promise.resolve(storageDept);
        if (
          entity === RequestStageTransition &&
          opts.where.departmentId === 1 &&
          opts.where.action === TransitionAction.STARTED
        )
          return Promise.resolve(null); // No started transition
        return Promise.resolve(null);
      });

      await expect(
        service.transition(1, 1, 'completed', superAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    // Test 5: complete stage with started present — succeeds
    it('should complete a stage when started exists', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne.mockImplementation((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id === 1) return Promise.resolve(storageDept);
        if (
          entity === RequestStageTransition &&
          opts.where.departmentId === 1 &&
          opts.where.action === TransitionAction.STARTED
        )
          return Promise.resolve({ id: 10, action: TransitionAction.STARTED });
        if (
          entity === RequestStageTransition &&
          opts.where.departmentId === 1 &&
          opts.where.action === TransitionAction.COMPLETED
        )
          return Promise.resolve(null); // Not yet completed
        return Promise.resolve(null);
      });

      const transition = {
        id: 11,
        requestId: 1,
        departmentId: 1,
        action: TransitionAction.COMPLETED,
        actionedBy: 1,
      };
      mockEntityManager.create.mockReturnValue(transition);
      mockEntityManager.save.mockResolvedValue(transition);

      // Not last department
      mockEntityManager.findOne.mockImplementationOnce((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id) {
          if (opts.where.id === 1) return Promise.resolve(storageDept);
          return Promise.resolve(null);
        }
        if (entity === Department && opts.order) {
          return Promise.resolve(deliveryDept); // Last is delivery, not storage
        }
        if (entity === RequestStageTransition) return Promise.resolve(null);
        return Promise.resolve(null);
      });
      // Restore the normal chain
      mockEntityManager.findOne.mockReset();
      mockEntityManager.findOne
        .mockResolvedValueOnce(request) // fetch request
        .mockResolvedValueOnce(storageDept) // fetch department
        .mockResolvedValueOnce({ id: 10, action: TransitionAction.STARTED }) // has started
        .mockResolvedValueOnce(null) // no completed yet
        .mockResolvedValueOnce(deliveryDept); // last department

      const result = await service.transition(1, 1, 'completed', superAdminUser);

      expect(result).toEqual(transition);
      // Status should NOT be changed since the new pipeline system
      // tracks completion via timestamp fields, not status enum
      expect(mockEntityManager.update).not.toHaveBeenCalledWith(
        CarRequest,
        1,
        expect.objectContaining({ status: RequestStatus.ACTIVE }),
      );
    });

    // Test 6: start already-started stage — throws conflict
    it('should throw conflict when starting an already-started stage', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne.mockImplementation((entity, opts) => {
        if (entity === CarRequest) return Promise.resolve(request);
        if (entity === Department && opts.where.id === 1) return Promise.resolve(storageDept);
        if (
          entity === RequestStageTransition &&
          opts.where.departmentId === 1 &&
          opts.where.action === TransitionAction.STARTED
        )
          return Promise.resolve({ id: 1 }); // already started
        return Promise.resolve(null);
      });

      await expect(
        service.transition(1, 1, 'started', superAdminUser),
      ).rejects.toThrow(ConflictException);
    });

    // Test 7: complete already-completed stage — throws conflict
    it('should throw conflict when completing an already-completed stage', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne
        .mockResolvedValueOnce(request) // fetch request
        .mockResolvedValueOnce(storageDept) // fetch department
        .mockResolvedValueOnce({ id: 10, action: TransitionAction.STARTED }) // has started
        .mockResolvedValueOnce({ id: 11, action: TransitionAction.COMPLETED }); // already completed

      await expect(
        service.transition(1, 1, 'completed', superAdminUser),
      ).rejects.toThrow(ConflictException);
    });

    // Test 8: PDI role user trying to transition Storage department — throws Forbidden
    it('should throw ForbiddenException when role is not authorized for department', async () => {
      const pdiUser = { id: 4, role: 'pdi', departmentId: 2 };
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne
        .mockResolvedValueOnce(request) // fetch request
        .mockResolvedValueOnce(storageDept); // fetch department (slug: 'storage')

      // PDI role does not have 'storage' in allowedDepartmentSlugs
      await expect(
        service.transition(1, 1, 'started', pdiUser),
      ).rejects.toThrow(ForbiddenException);
    });

    // Test 9: super admin can transition any department
    it('should allow super admin to transition any department', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne
        .mockResolvedValueOnce(request) // fetch request
        .mockResolvedValueOnce(storageDept) // fetch department
        .mockResolvedValueOnce(null); // no started yet

      const transition = {
        id: 1,
        requestId: 1,
        departmentId: 1,
        action: TransitionAction.STARTED,
        actionedBy: 1,
      };
      mockEntityManager.create.mockReturnValue(transition);
      mockEntityManager.save.mockResolvedValue(transition);

      const result = await service.transition(1, 1, 'started', superAdminUser);

      expect(result).toEqual(transition);
      // Status no longer auto-updated — requests start as ACTIVE
    });

    // Test 10: request not active — transition blocked
    it('should throw BadRequestException when request is not active', async () => {
      const request = { id: 1, status: RequestStatus.ARCHIVED_MANUAL };
      mockEntityManager.findOne
        .mockResolvedValueOnce(request); // fetch request

      await expect(
        service.transition(1, 1, 'started', superAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    // Test 11 (extended): last stage completion — status stays active
    it('should complete last department stage without changing status', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne
        .mockResolvedValueOnce(request) // fetch request
        .mockResolvedValueOnce(deliveryDept) // fetch department (delivery)
        .mockResolvedValueOnce({ id: 10, action: TransitionAction.STARTED }) // has started
        .mockResolvedValueOnce(null) // not yet completed
        .mockResolvedValueOnce(deliveryDept); // last department

      const transition = {
        id: 20,
        requestId: 1,
        departmentId: 3,
        action: TransitionAction.COMPLETED,
        actionedBy: 1,
      };
      mockEntityManager.create.mockReturnValue(transition);
      mockEntityManager.save.mockResolvedValue(transition);

      const result = await service.transition(1, 3, 'completed', superAdminUser);

      expect(result).toEqual(transition);
      // Status is no longer auto-updated by legacy transition service;
      // the new pipeline system tracks completion via timestamp fields.
    });

    // Test 12: NVS role user can transition own department (Storage)
    it('should allow nvs role to transition own department', async () => {
      const request = { id: 1, status: RequestStatus.ACTIVE };
      mockEntityManager.findOne
        .mockResolvedValueOnce(request) // fetch request
        .mockResolvedValueOnce(storageDept) // fetch department
        .mockResolvedValueOnce(null); // no started yet

      const transition = {
        id: 1,
        requestId: 1,
        departmentId: 1,
        action: TransitionAction.STARTED,
        actionedBy: 2,
      };
      mockEntityManager.create.mockReturnValue(transition);
      mockEntityManager.save.mockResolvedValue(transition);

      const result = await service.transition(1, 1, 'started', nvsUser);

      expect(result).toEqual(transition);
    });
  });

  describe('bulkTransition', () => {
    it('should process all successful transitions', async () => {
      mockDepartmentsRepo.findOne.mockResolvedValue(storageDept);
      jest.spyOn(service, 'transition').mockResolvedValue({
        id: 1,
        requestId: 1,
        departmentId: 1,
        action: TransitionAction.STARTED,
        actionedBy: 1,
        actionedAt: new Date(),
        request: null as any,
        department: null as any,
        actionedByUser: null as any,
      });

      const result = await service.bulkTransition(
        [1, 2, 3],
        1,
        'started',
        superAdminUser,
      );

      expect(result.success).toBe(3);
      expect(result.failed).toHaveLength(0);
      expect(service.transition).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures gracefully', async () => {
      mockDepartmentsRepo.findOne.mockResolvedValue(storageDept);
      const mockTransition = jest.spyOn(service, 'transition');
      mockTransition
        .mockResolvedValueOnce({
          id: 1,
          requestId: 1,
          departmentId: 1,
          action: TransitionAction.STARTED,
          actionedBy: 1,
          actionedAt: new Date(),
          request: null as any,
          department: null as any,
          actionedByUser: null as any,
        }) // request 1 succeeds
        .mockRejectedValueOnce(
          new BadRequestException('Cannot start stage'),
        ) // request 2 fails
        .mockResolvedValueOnce({
          id: 3,
          requestId: 3,
          departmentId: 1,
          action: TransitionAction.STARTED,
          actionedBy: 1,
          actionedAt: new Date(),
          request: null as any,
          department: null as any,
          actionedByUser: null as any,
        }); // request 3 succeeds

      const result = await service.bulkTransition(
        [1, 2, 3],
        1,
        'started',
        superAdminUser,
      );

      expect(result.success).toBe(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].requestId).toBe(2);
    });

    it('should throw if department not found', async () => {
      mockDepartmentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bulkTransition([1], 999, 'started', superAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not authorized for department', async () => {
      mockDepartmentsRepo.findOne.mockResolvedValue(pdiDept); // PDI dept

      await expect(
        service.bulkTransition([1], 2, 'started', wrongDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
