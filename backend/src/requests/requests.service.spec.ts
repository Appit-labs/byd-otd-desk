import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { RequestsService } from './requests.service';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity';
import { PipelineStageResolverService } from './pipeline-stage-resolver.service';

// Mock the SettingOption entity for the calculatePromiseDate helper
jest.mock('../database/entities/setting-option.entity', () => ({
  SettingOption: class MockSettingOption {},
}));

describe('RequestsService', () => {
  let service: RequestsService;
  let mockRequestsRepo: any;
  let mockTransitionsRepo: any;
  let mockPipelineResolver: any;

  const mockRequest = {
    id: 1,
    requestNumber: 'BYD-2026-0001',
    requestTypeId: 1,
    chassisNumber: 'ABC1234',
    brandId: null,
    modelId: null,
    variantId: null,
    exteriorColorId: null,
    interiorColorId: null,
    vehicleLocation: null,
    showroomId: null,
    customerName: 'John Smith',
    customerPhone: '+628123456789',
    salesConsultantId: 1,
    salesTypeId: null,
    accessories: null,
    hasGps: false,
    promiseDate: null,
    remarks: 'Test remarks',
    createdBy: 1,
    status: RequestStatus.ACTIVE,
    createdAt: new Date('2026-06-12T10:00:00.000Z'),
    // Pipeline timestamps
    storageAt: null,
    vehicleReceivedAt: null,
    mechanicalCheckStartedAt: null,
    mechanicalCheckCompletedAt: null,
    pdiStartedAt: null,
    pdiCompletedAt: null,
    sentToAccessoriesAt: null,
    accessoriesStartedAt: null,
    accessoriesCompletedAt: null,
    finalInspectionAt: null,
    finalInspectionOutcome: null,
    finalInspectionRemarks: null,
    gpsConfirmedAt: null,
    registeredAt: null,
    deliveredAt: null,
    deliveryRemarks: null,
    // Durations
    mechanicalCheckDuration: null,
    pdiDuration: null,
    accessoriesDuration: null,
    // Relations
    requestType: { id: 1, label: 'PDI', value: 'pdi' },
    brand: null,
    model: null,
    variant: null,
    exteriorColor: null,
    interiorColor: null,
    showroom: null,
    salesConsultant: { id: 1, label: 'Ahmed Hassan', value: 'ahmed_hassan' },
    salesType: null,
    creator: { id: 1, fullName: 'Admin' },
    transitions: [],
  };

  const mockCreateQueryBuilder = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  });

  beforeEach(async () => {
    mockRequestsRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOneBy: jest.fn().mockResolvedValue({
            id: 1,
            value: 'pdi',
            label: 'PDI',
          }),
        }),
      },
    };

    mockTransitionsRepo = {
      delete: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockPipelineResolver = {
      isRoleAuthorizedForStage: jest.fn().mockReturnValue(true),
      isRequestAtStage: jest.fn().mockReturnValue(true),
      resolveCurrentStage: jest.fn(),
    };

    // Mute logger during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(CarRequest),
          useValue: mockRequestsRepo,
        },
        {
          provide: getRepositoryToken(RequestStageTransition),
          useValue: mockTransitionsRepo,
        },
        {
          provide: PipelineStageResolverService,
          useValue: mockPipelineResolver,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  describe('findAll', () => {
    it('should return paginated requests with default pagination', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockRequest], 1]);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result.items).toEqual([mockRequest]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by status', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockRequest], 1]);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ status: RequestStatus.ACTIVE });

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: RequestStatus.ACTIVE,
      });
    });
  });

  describe('findById', () => {
    it('should return a request by id with all relations', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(mockRequest);

      const result = await service.findById(1);

      expect(result).toEqual(mockRequest);
      expect(mockRequestsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: expect.arrayContaining([
          'requestType',
          'showroom',
          'transitions',
        ]),
      });
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      requestTypeId: 1,
      chassisNumber: 'abc1234',
      customerName: 'John Smith',
      customerPhone: '+628123456789',
      salesConsultantId: 1,
      remarks: 'Test',
    };

    it('should generate request number and set status to active', async () => {
      const qb = mockCreateQueryBuilder();
      const year = new Date().getFullYear().toString();
      qb.getOne.mockResolvedValue(null);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const saved = {
        ...createDto,
        id: 1,
        requestNumber: `BYD-${year}-0001`,
        createdBy: 1,
        status: RequestStatus.ACTIVE,
        createdAt: new Date(),
        chassisNumber: 'ABC1234',
      };
      mockRequestsRepo.create.mockReturnValue(saved);
      mockRequestsRepo.save.mockResolvedValue(saved);

      const result = await service.create(createDto, 1) as any;

      expect(result.requestNumber).toBe(`BYD-${year}-0001`);
      expect(result.status).toBe(RequestStatus.ACTIVE);
      expect(result.createdBy).toBe(1);
    });

    it('should auto-uppercase chassis_number on create', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const saved = {
        ...createDto,
        id: 1,
        requestNumber: 'BYD-2026-0001',
        createdBy: 1,
        status: RequestStatus.ACTIVE,
        chassisNumber: 'ABC1234',
        createdAt: new Date(),
      };
      mockRequestsRepo.create.mockReturnValue(saved);
      mockRequestsRepo.save.mockResolvedValue(saved);

      const result = await service.create(createDto, 1) as any;

      expect(result.chassisNumber).toBe('ABC1234');
    });

    it('should throw ConflictException after exhausting retries', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const dupError = new QueryFailedError(
        'INSERT INTO car_requests ...',
        [],
        new Error('Duplicate entry'),
      );
      (dupError as any).code = 'ER_DUP_ENTRY';

      mockRequestsRepo.save.mockRejectedValue(dupError);
      mockRequestsRepo.create.mockReturnValue({
        ...createDto,
        id: 1,
        status: RequestStatus.ACTIVE,
      });

      await expect(service.create(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRequestsRepo.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('update', () => {
    it('should not overwrite request_number or created_by', async () => {
      mockRequestsRepo.findOne
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(mockRequest);
      mockRequestsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { customerName: 'Updated Name' } as any);

      expect(mockRequestsRepo.update).toHaveBeenCalledWith(1, {
        customerName: 'Updated Name',
      });
      expect(result).toBeDefined();
    });

    it('should throw if request not found', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { customerName: 'Nope' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete transitions and request', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(mockRequest);
      mockTransitionsRepo.delete.mockResolvedValue({ affected: 1 });
      mockRequestsRepo.remove.mockResolvedValue(mockRequest);

      await service.delete(1);

      expect(mockTransitionsRepo.delete).toHaveBeenCalledWith({
        requestId: 1,
      });
      expect(mockRequestsRepo.remove).toHaveBeenCalledWith(mockRequest);
    });

    it('should throw if request not found', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
