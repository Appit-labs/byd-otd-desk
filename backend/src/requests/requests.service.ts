import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, QueryFailedError } from 'typeorm';
import { CarRequest, RequestStatus } from '../database/entities/car-request.entity.js';
import { RequestStageTransition } from '../database/entities/request-stage-transition.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { QueryRequestsDto } from './dto/query-requests.dto.js';

type ExportPeriod = 'week' | 'month' | 'year' | 'all';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);
  private readonly allowedLimitValues = [10, 20, 50, 100];
  private readonly maxRetries = 3;

  constructor(
    @InjectRepository(CarRequest)
    private requestsRepository: Repository<CarRequest>,
    @InjectRepository(RequestStageTransition)
    private transitionsRepository: Repository<RequestStageTransition>,
  ) {}

  async findAll(
    query: QueryRequestsDto,
  ): Promise<{ items: CarRequest[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    let limit = query.limit ?? 20;

    if (!this.allowedLimitValues.includes(limit)) {
      limit = 20;
    }

    const skip = (page - 1) * limit;

    const qb = this.requestsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestType', 'requestType')
      .leftJoinAndSelect('r.carColor', 'carColor')
      .leftJoinAndSelect('r.carSpec', 'carSpec')
      .leftJoinAndSelect('r.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('r.seller', 'seller')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.transitions', 'transitions')
      .leftJoinAndSelect('transitions.department', 'transitionDepartment')
      .leftJoinAndSelect('transitions.actionedByUser', 'actionedByUser');

    // Search across request_number, car_number, client_name
    if (query.search) {
      const searchTerm = `%${query.search}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('r.requestNumber LIKE :searchTerm', { searchTerm })
            .orWhere('r.carNumber LIKE :searchTerm', { searchTerm })
            .orWhere('r.clientName LIKE :searchTerm', { searchTerm });
        }),
      );
    }

    // Filter by status
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    // Filter by department_id (requests that have a transition for this department)
    if (query.departmentId) {
      qb.andWhere('transitions.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }

    // Filter by date range
    if (query.dateFrom) {
      qb.andWhere('r.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('r.createdAt <= :dateTo', { dateTo: query.dateTo });
    }

    // Filter by request_type_id
    if (query.requestTypeId) {
      qb.andWhere('r.requestTypeId = :requestTypeId', {
        requestTypeId: query.requestTypeId,
      });
    }

    // Filter by seller_id
    if (query.sellerId) {
      qb.andWhere('r.sellerId = :sellerId', { sellerId: query.sellerId });
    }

    // Sort — accepts both snake_case (API convention) and camelCase (entity properties)
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    const columnMap: Record<string, string> = {
      created_at: 'createdAt',
      request_number: 'requestNumber',
      car_number: 'carNumber',
      client_name: 'clientName',
      createdAt: 'createdAt',
      requestNumber: 'requestNumber',
      carNumber: 'carNumber',
      clientName: 'clientName',
      status: 'status',
    };
    const safeSortBy = columnMap[sortBy] || 'createdAt';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`r.${safeSortBy}`, safeSortOrder);

    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit };
  }

  async findById(id: number): Promise<CarRequest> {
    const request = await this.requestsRepository.findOne({
      where: { id },
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

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear().toString();
    const prefix = `BYD-${year}-`;

    // Find the highest sequence number for this year
    const lastRequest = await this.requestsRepository
      .createQueryBuilder('r')
      .where('r.requestNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.requestNumber', 'DESC')
      .getOne();

    let nextSeq = 1;
    if (lastRequest) {
      const lastNumber = lastRequest.requestNumber;
      const parts = lastNumber.split('-');
      const seqPart = parts[parts.length - 1];
      nextSeq = parseInt(seqPart, 10) + 1;
    }

    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  async create(dto: CreateRequestDto, userId: number): Promise<CarRequest> {
    const carNumber = dto.carNumber.toUpperCase();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const requestNumber = await this.generateRequestNumber();

      const request = this.requestsRepository.create({
        requestTypeId: dto.requestTypeId,
        carNumber,
        bodyNumber: dto.bodyNumber,
        carColorId: dto.carColorId,
        carSpecId: dto.carSpecId,
        clientName: dto.clientName,
        clientTel: dto.clientTel,
        paymentMethodId: dto.paymentMethodId,
        sellerId: dto.sellerId,
        remarks: dto.remarks,
        requestNumber,
        createdBy: userId,
        status: RequestStatus.NOT_STARTED,
        createdAt: new Date(dto.createdAt),
      });

      try {
        return await this.requestsRepository.save(request);
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          (error as any).code === 'ER_DUP_ENTRY'
        ) {
          this.logger.warn(
            `Duplicate request number ${requestNumber}, retrying (attempt ${attempt + 1}/${this.maxRetries})`,
          );
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Failed to generate unique request number after multiple attempts',
    );
  }

  async update(id: number, dto: UpdateRequestDto): Promise<CarRequest> {
    const request = await this.findById(id);

    // Only allow updating specific fields — never overwrite requestNumber or createdBy
    const allowedFields: (keyof UpdateRequestDto)[] = [
      'requestTypeId',
      'carNumber',
      'bodyNumber',
      'carColorId',
      'carSpecId',
      'clientName',
      'clientTel',
      'paymentMethodId',
      'sellerId',
      'remarks',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in dto && dto[field] !== undefined) {
        if (field === 'carNumber') {
          updateData['carNumber'] = (dto[field] as string).toUpperCase();
        } else {
          updateData[field] = dto[field];
        }
      }
    }

    await this.requestsRepository.update(id, updateData);

    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    const request = await this.findById(id);

    // Delete associated transitions first (no cascade configured)
    await this.transitionsRepository.delete({ requestId: id });

    await this.requestsRepository.remove(request);
  }

  async toggleHold(id: number): Promise<CarRequest> {
    const request = await this.requestsRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status === RequestStatus.ON_HOLD) {
      // Restore from on_hold
      // Check if there are transitions → pending, otherwise → not_started
      const transitionCount = await this.transitionsRepository.count({
        where: { requestId: id },
      });

      request.status =
        transitionCount > 0
          ? RequestStatus.PENDING
          : RequestStatus.NOT_STARTED;
    } else {
      // Set to on_hold
      request.status = RequestStatus.ON_HOLD;
    }

    return this.requestsRepository.save(request);
  }

  async exportCsv(period: ExportPeriod): Promise<string> {
    // Calculate date range
    const now = new Date();
    let dateFrom: Date | undefined;

    switch (period) {
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        dateFrom = undefined;
        break;
    }

    // Build query — fetch ALL matching requests (no pagination)
    const qb = this.requestsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestType', 'requestType')
      .leftJoinAndSelect('r.carColor', 'carColor')
      .leftJoinAndSelect('r.carSpec', 'carSpec')
      .leftJoinAndSelect('r.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('r.seller', 'seller')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.transitions', 'transitions')
      .leftJoinAndSelect('transitions.department', 'transitionDepartment')
      .leftJoinAndSelect('transitions.actionedByUser', 'actionedByUser')
      .orderBy('r.createdAt', 'DESC');

    if (dateFrom) {
      qb.andWhere('r.createdAt >= :dateFrom', { dateFrom });
    }

    const items = await qb.getMany();

    // Helper: escape CSV value
    const esc = (value: unknown): string => {
      const str = value == null ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV rows
    const header = [
      'Request Number',
      'Car Number',
      'Body Number',
      'Request Type',
      'Car Color',
      'Car Spec',
      'Client Name',
      'Client Tel',
      'Payment Method',
      'Seller',
      'Status',
      'Created At',
      'Completed At',
      'Remarks',
    ];

    const rows = items.map((r) => [
      esc(r.requestNumber),
      esc(r.carNumber),
      esc(r.bodyNumber),
      esc(r.requestType?.label ?? ''),
      esc(r.carColor?.label ?? ''),
      esc(r.carSpec?.label ?? ''),
      esc(r.clientName),
      esc(r.clientTel),
      esc(r.paymentMethod?.label ?? ''),
      esc(r.seller?.fullName ?? ''),
      esc(r.status),
      esc(r.createdAt?.toISOString() ?? ''),
      esc(r.completedAt?.toISOString() ?? ''),
      esc(r.remarks),
    ]);

    const bom = '﻿';
    const csvContent = [
      header.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return bom + csvContent;
  }
}
