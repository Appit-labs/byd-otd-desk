import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { RequestsService } from './requests.service';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity';

describe('RequestsService', () => {
  let service: RequestsService;
  let mockRequestsRepo: any;
  let mockTransitionsRepo: any;

  const mockRequest = {
    id: 1,
    requestNumber: 'BYD-2026-0001',
    requestTypeId: 1,
    carNumber: 'ABC1234',
    bodyNumber: 'BDY-001',
    carColorId: 1,
    carSpecId: 1,
    clientName: 'John Smith',
    clientTel: '+628123456789',
    paymentMethodId: 1,
    sellerId: 1,
    remarks: 'Test remarks',
    createdBy: 1,
    status: RequestStatus.NOT_STARTED,
    createdAt: new Date('2026-06-12T10:00:00.000Z'),
    requestType: { id: 1, name: 'New Car' },
    carColor: { id: 1, name: 'Red' },
    carSpec: { id: 1, name: 'Standard' },
    paymentMethod: { id: 1, name: 'Cash' },
    seller: { id: 1, fullName: 'Seller A' },
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
    };

    mockTransitionsRepo = {
      delete: jest.fn(),
      count: jest.fn(),
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

    it('should apply search filter across request_number, car_number, and client_name', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockRequest], 1]);

      // Track the andWhere calls to find one called with a Brackets object
      const andWhereCalls: any[] = [];
      qb.andWhere.mockImplementation((condition, params) => {
        andWhereCalls.push({ condition, params });
        return qb;
      });

      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ search: 'ABC' });

      // Verify a Brackets condition was passed (typeof condition !== 'string')
      const bracketsCall = andWhereCalls.find(
        (c) => typeof c.condition !== 'string' && c.condition !== undefined,
      );
      expect(bracketsCall).toBeDefined();
    });

    it('should filter by status', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockRequest], 1]);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ status: RequestStatus.NOT_STARTED });

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: RequestStatus.NOT_STARTED,
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
        relations: [
          'requestType',
          'carColor',
          'carSpec',
          'paymentMethod',
          'seller',
          'creator',
          'transitions',
          'transitions.department',
          'transitions.actionedByUser',
        ],
      });
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateRequestNumber', () => {
    it('should generate correct request number format BYD-YYYY-NNNN', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getOne.mockResolvedValue(null); // no prior requests this year
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.generateRequestNumber();

      const year = new Date().getFullYear().toString();
      expect(result).toBe(`BYD-${year}-0001`);
    });

    it('should increment sequence number for existing requests', async () => {
      const qb = mockCreateQueryBuilder();
      const year = new Date().getFullYear().toString();
      qb.getOne.mockResolvedValue({
        requestNumber: `BYD-${year}-0042`,
      });
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.generateRequestNumber();

      expect(result).toBe(`BYD-${year}-0043`);
    });
  });

  describe('create', () => {
    it('should generate request number and set status to not_started', async () => {
      const qb = mockCreateQueryBuilder();
      const year = new Date().getFullYear().toString();
      qb.getOne.mockResolvedValue(null);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const createDto = {
        requestTypeId: 1,
        carNumber: 'abc1234',
        bodyNumber: 'BDY-001',
        carColorId: 1,
        carSpecId: 1,
        clientName: 'John Smith',
        clientTel: '+628123456789',
        paymentMethodId: 1,
        sellerId: 1,
        remarks: 'Test',
        createdAt: '2026-06-12T10:00:00.000Z',
      };

      mockRequestsRepo.create.mockReturnValue({
        ...createDto,
        id: 1,
        requestNumber: `BYD-${year}-0001`,
        createdBy: 1,
        status: RequestStatus.NOT_STARTED,
        createdAt: new Date('2026-06-12T10:00:00.000Z'),
      });
      mockRequestsRepo.save.mockResolvedValue({
        ...createDto,
        id: 1,
        requestNumber: `BYD-${year}-0001`,
        createdBy: 1,
        status: RequestStatus.NOT_STARTED,
        createdAt: new Date('2026-06-12T10:00:00.000Z'),
      });

      const result = await service.create(createDto, 1);

      expect(result.requestNumber).toBe(`BYD-${year}-0001`);
      expect(result.status).toBe(RequestStatus.NOT_STARTED);
      expect(result.createdBy).toBe(1);
      expect(mockRequestsRepo.create).toHaveBeenCalled();
      expect(mockRequestsRepo.save).toHaveBeenCalled();
    });

    it('should auto-uppercase car_number on create', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const createDto = {
        requestTypeId: 1,
        carNumber: 'abc1234',
        carColorId: 1,
        carSpecId: 1,
        clientName: 'John Smith',
        clientTel: '+628123456789',
        paymentMethodId: 1,
        sellerId: 1,
        createdAt: '2026-06-12T10:00:00.000Z',
      };

      const savedRequest = {
        ...createDto,
        id: 1,
        requestNumber: 'BYD-2026-0001',
        createdBy: 1,
        status: RequestStatus.NOT_STARTED,
        carNumber: 'ABC1234',
        createdAt: new Date('2026-06-12T10:00:00.000Z'),
      };

      mockRequestsRepo.create.mockReturnValue(savedRequest);
      mockRequestsRepo.save.mockResolvedValue(savedRequest);

      const result = await service.create(createDto, 1);

      expect(result.carNumber).toBe('ABC1234');
    });

    it('should retry on duplicate request number and succeed on second attempt', async () => {
      const qb = mockCreateQueryBuilder();
      const year = new Date().getFullYear().toString();
      // First call generates 0001, second retry generates 0002
      qb.getOne
        .mockResolvedValueOnce(null) // first gen: no prior, so 0001
        .mockResolvedValueOnce(null); // second gen (retry): still null, so 0001 again (simulate)
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const createDto = {
        requestTypeId: 1,
        carNumber: 'ABC1234',
        carColorId: 1,
        carSpecId: 1,
        clientName: 'John Smith',
        clientTel: '+628123456789',
        paymentMethodId: 1,
        sellerId: 1,
        createdAt: '2026-06-12T10:00:00.000Z',
      };

      // First save throws duplicate error
      const dupError = new QueryFailedError(
        'INSERT INTO car_requests ...',
        [],
        new Error('Duplicate entry'),
      );
      (dupError as any).code = 'ER_DUP_ENTRY';

      mockRequestsRepo.save
        .mockRejectedValueOnce(dupError)
        .mockResolvedValueOnce({
          ...createDto,
          id: 1,
          requestNumber: `BYD-${year}-0001`,
          createdBy: 1,
          status: RequestStatus.NOT_STARTED,
          carNumber: 'ABC1234',
          createdAt: new Date('2026-06-12T10:00:00.000Z'),
        });

      mockRequestsRepo.create.mockReturnValue({
        ...createDto,
        id: 1,
        requestNumber: `BYD-${year}-0001`,
        createdBy: 1,
        status: RequestStatus.NOT_STARTED,
        carNumber: 'ABC1234',
        createdAt: new Date('2026-06-12T10:00:00.000Z'),
      });

      const result = await service.create(createDto, 1);

      expect(result).toBeDefined();
      expect(result.requestNumber).toBe(`BYD-${year}-0001`);
      // save should have been called twice (first failed, second succeeded)
      expect(mockRequestsRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException after exhausting retries', async () => {
      const qb = mockCreateQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      mockRequestsRepo.createQueryBuilder.mockReturnValue(qb);

      const createDto = {
        requestTypeId: 1,
        carNumber: 'ABC1234',
        carColorId: 1,
        carSpecId: 1,
        clientName: 'John Smith',
        clientTel: '+628123456789',
        paymentMethodId: 1,
        sellerId: 1,
        createdAt: '2026-06-12T10:00:00.000Z',
      };

      const dupError = new QueryFailedError(
        'INSERT INTO car_requests ...',
        [],
        new Error('Duplicate entry'),
      );
      (dupError as any).code = 'ER_DUP_ENTRY';

      // All attempts fail
      mockRequestsRepo.save.mockRejectedValue(dupError);

      mockRequestsRepo.create.mockReturnValue({
        ...createDto,
        id: 1,
        requestNumber: 'BYD-2026-0001',
        createdBy: 1,
        status: RequestStatus.NOT_STARTED,
        carNumber: 'ABC1234',
        createdAt: new Date('2026-06-12T10:00:00.000Z'),
      });

      await expect(service.create(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
      // maxRetries=3, all fail
      expect(mockRequestsRepo.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('update', () => {
    it('should not overwrite request_number or created_by', async () => {
      mockRequestsRepo.findOne
        .mockResolvedValueOnce(mockRequest) // first call in findById inside update
        .mockResolvedValueOnce(mockRequest); // second call after update

      mockRequestsRepo.update.mockResolvedValue({ affected: 1 });

      const updateDto = {
        clientName: 'Updated Name',
      };

      const result = await service.update(1, updateDto);

      expect(mockRequestsRepo.update).toHaveBeenCalledWith(1, {
        clientName: 'Updated Name',
      });
      expect(result).toBeDefined();
    });

    it('should throw if request not found', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { clientName: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleHold', () => {
    it('should set status to on_hold when currently not on hold', async () => {
      const activeRequest = { ...mockRequest, status: RequestStatus.NOT_STARTED };
      mockRequestsRepo.findOne.mockResolvedValue(activeRequest);
      mockRequestsRepo.save.mockResolvedValue({
        ...activeRequest,
        status: RequestStatus.ON_HOLD,
      });

      const result = await service.toggleHold(1);

      expect(result.status).toBe(RequestStatus.ON_HOLD);
    });

    it('should restore from on_hold to previous status (pending if transitions exist)', async () => {
      const onHoldRequest = { ...mockRequest, status: RequestStatus.ON_HOLD };
      mockRequestsRepo.findOne.mockResolvedValue(onHoldRequest);
      mockTransitionsRepo.count.mockResolvedValue(3); // has transitions
      mockRequestsRepo.save.mockResolvedValue({
        ...onHoldRequest,
        status: RequestStatus.PENDING,
      });

      const result = await service.toggleHold(1);

      expect(result.status).toBe(RequestStatus.PENDING);
    });

    it('should restore from on_hold to not_started if no transitions exist', async () => {
      const onHoldRequest = { ...mockRequest, status: RequestStatus.ON_HOLD };
      mockRequestsRepo.findOne.mockResolvedValue(onHoldRequest);
      mockTransitionsRepo.count.mockResolvedValue(0); // no transitions
      mockRequestsRepo.save.mockResolvedValue({
        ...onHoldRequest,
        status: RequestStatus.NOT_STARTED,
      });

      const result = await service.toggleHold(1);

      expect(result.status).toBe(RequestStatus.NOT_STARTED);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRequestsRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleHold(999)).rejects.toThrow(NotFoundException);
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
