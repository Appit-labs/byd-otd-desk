import { spawnSync } from 'child_process';
import * as path from 'path';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, QueryFailedError } from 'typeorm';
import {
  CarRequest,
  RequestStatus,
  PipelineStage,
} from '../database/entities/car-request.entity.js';
import { RequestStageTransition, TransitionAction } from '../database/entities/request-stage-transition.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { QueryRequestsDto } from './dto/query-requests.dto.js';
import {
  FinalInspectionDto,
  ConfirmDeliveryDto,
  MechanicalCheckCompleteDto,
  PdiCompleteDto,
  AccessoriesCompleteDto,
  ReactivateDto,
} from './dto/stage-action.dto.js';
import { addWorkingDays } from '../common/utils/dates.js';
import {
  PipelineStageResolverService,
} from './pipeline-stage-resolver.service.js';
import { EmailService } from '../email/email.service.js';

type ExportPeriod = 'week' | 'month' | 'year' | 'all';

/** User shape passed from controller via @CurrentUser */
export interface ActionUser {
  id: number;
  role: string;
  departmentId: number | null;
}

/** Extra working days when accessories are selected (default fallback) */
const ACCESSORIES_EXTRA_DAYS = 7;

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
    private pipelineStageResolver: PipelineStageResolverService,
    private emailService: EmailService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  //  Query helpers
  // ─────────────────────────────────────────────────────────────

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
      .leftJoinAndSelect('r.brand', 'brand')
      .leftJoinAndSelect('r.model', 'model')
      .leftJoinAndSelect('r.variant', 'variant')
      .leftJoinAndSelect('r.exteriorColor', 'exteriorColor')
      .leftJoinAndSelect('r.interiorColor', 'interiorColor')
      .leftJoinAndSelect('r.showroom', 'showroom')
      .leftJoinAndSelect('r.salesConsultant', 'salesConsultant')
      .leftJoinAndSelect('r.salesType', 'salesType')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.transitions', 'transitions')
      .leftJoinAndSelect('transitions.department', 'transitionDepartment')
      .leftJoinAndSelect('transitions.actionedByUser', 'actionedByUser');

    // Search across request_number, chassis_number, customer_name
    if (query.search) {
      const searchTerm = `%${query.search}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('r.requestNumber LIKE :searchTerm', { searchTerm })
            .orWhere('r.chassisNumber LIKE :searchTerm', { searchTerm })
            .orWhere('r.customerName LIKE :searchTerm', { searchTerm });
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

    // Filter by brand_id
    if (query.brandId) {
      qb.andWhere('r.brandId = :brandId', { brandId: query.brandId });
    }

    // Filter by sales_consultant_id
    if (query.salesConsultantId) {
      qb.andWhere('r.salesConsultantId = :salesConsultantId', {
        salesConsultantId: query.salesConsultantId,
      });
    }

    // Timeliness filter: on_time / delayed
    // is_delayed = (delivered_at IS NULL AND now() > promise_date)
    //           OR (delivered_at IS NOT NULL AND delivered_at > promise_date)
    if (query.timeliness === 'on_time') {
      qb.andWhere(
        `(r.deliveredAt IS NOT NULL AND r.deliveredAt <= r.promiseDate) OR (r.deliveredAt IS NULL AND r.promiseDate >= NOW())`,
      );
    } else if (query.timeliness === 'delayed') {
      qb.andWhere(
        `(r.deliveredAt IS NOT NULL AND r.deliveredAt > r.promiseDate) OR (r.deliveredAt IS NULL AND r.promiseDate < NOW())`,
      );
    }

    // Sort
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    const columnMap: Record<string, string> = {
      created_at: 'createdAt',
      request_number: 'requestNumber',
      chassis_number: 'chassisNumber',
      customer_name: 'customerName',
      promise_date: 'promiseDate',
      createdAt: 'createdAt',
      requestNumber: 'requestNumber',
      chassisNumber: 'chassisNumber',
      customerName: 'customerName',
      promiseDate: 'promiseDate',
      status: 'status',
    };
    const safeSortBy = columnMap[sortBy] || 'createdAt';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`r.${safeSortBy}`, safeSortOrder);

    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Attach computed isDelayed to each item
    const now = new Date();
    for (const item of items) {
      const deliveredAt = item.deliveredAt ? new Date(item.deliveredAt) : null;
      const promiseDate = item.promiseDate ? new Date(item.promiseDate) : null;

      if (deliveredAt && promiseDate) {
        (item as any).isDelayed = deliveredAt.getTime() > promiseDate.getTime();
      } else if (!deliveredAt && promiseDate) {
        (item as any).isDelayed = now.getTime() > promiseDate.getTime();
      } else {
        (item as any).isDelayed = false;
      }
    }

    return { items, total, page, limit };
  }

  async findById(id: number): Promise<CarRequest> {
    const request = await this.requestsRepository.findOne({
      where: { id },
      relations: [
        'requestType',
        'brand',
        'model',
        'variant',
        'exteriorColor',
        'interiorColor',
        'showroom',
        'salesConsultant',
        'salesType',
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

  private async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear().toString();
    const prefix = `BYD-${year}-`;

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

  private async calculatePromiseDate(
    requestTypeId: number,
    accessoryIds?: number[],
  ): Promise<Date | null> {
    const { SettingOption } = await import(
      '../database/entities/setting-option.entity.js'
    );
    const optionRepo = this.requestsRepository.manager.getRepository(SettingOption);
    const requestTypeOption = await optionRepo.findOneBy({ id: requestTypeId });

    if (!requestTypeOption) return null;

    // Read working_days from metadata, fall back to hardcoded defaults
    const baseDays =
      requestTypeOption.metadata?.working_days ??
      (requestTypeOption.value === 'pdi' || requestTypeOption.value === 're_pdi' ? 7 : 2);

    const hasAccessories = accessoryIds && accessoryIds.length > 0;
    const totalDays = hasAccessories ? baseDays + ACCESSORIES_EXTRA_DAYS : baseDays;

    return addWorkingDays(new Date(), totalDays);
  }

  // ─────────────────────────────────────────────────────────────
  //  CRUD
  // ─────────────────────────────────────────────────────────────

  async create(dto: CreateRequestDto, userId: number): Promise<CarRequest> {
    const chassisNumber = dto.chassisNumber.toUpperCase();

    const promiseDate = await this.calculatePromiseDate(
      dto.requestTypeId,
      dto.accessories,
    );

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const requestNumber = await this.generateRequestNumber();

      const request = this.requestsRepository.create({
        requestTypeId: dto.requestTypeId,
        chassisNumber,
        brandId: dto.brandId,
        modelId: dto.modelId,
        variantId: dto.variantId,
        exteriorColorId: dto.exteriorColorId,
        interiorColorId: dto.interiorColorId,
        vehicleLocation: dto.vehicleLocation,
        showroomId: dto.showroomId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        salesConsultantId: dto.salesConsultantId,
        salesTypeId: dto.salesTypeId,
        accessories: dto.accessories,
        hasGps: dto.hasGps ?? false,
        hasAccessories: dto.hasAccessories ?? false,
        promiseDate,
        remarks: dto.remarks,
        requestNumber,
        createdBy: userId,
        status: RequestStatus.ACTIVE,
        createdAt: new Date(),
      } as CarRequest);

      try {
        const saved = await this.requestsRepository.save(request);
        // Fire-and-forget notification to NVS
        Promise.resolve()
          .then(() => this.emailService.notifyRole('nvs', 'create', saved as CarRequest))
          .catch((err) => this.logger.error(`Notification failed (create): ${err}`));
        return saved as CarRequest;
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

    const allowedFields = [
      'requestTypeId',
      'chassisNumber',
      'brandId',
      'modelId',
      'variantId',
      'exteriorColorId',
      'interiorColorId',
      'vehicleLocation',
      'showroomId',
      'customerName',
      'customerPhone',
      'salesConsultantId',
      'salesTypeId',
      'accessories',
      'hasAccessories',
      'hasGps',
      'remarks',
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in dto && dto[field] !== undefined) {
        if (field === 'chassisNumber') {
          updateData[field] = (dto[field] as string).toUpperCase();
        } else {
          updateData[field] = dto[field];
        }
      }
    }

    // Recalculate promise date if request type or accessories changed
    const newRequestTypeId =
      updateData['requestTypeId'] !== undefined
        ? (updateData['requestTypeId'] as number)
        : request.requestTypeId;
    const newAccessories =
      updateData['accessories'] !== undefined
        ? (updateData['accessories'] as number[] | undefined)
        : request.accessories;
    if (
      updateData['requestTypeId'] !== undefined ||
      updateData['accessories'] !== undefined
    ) {
      const promiseDate = await this.calculatePromiseDate(
        newRequestTypeId,
        newAccessories,
      );
      updateData['promiseDate'] = promiseDate;
    }

    await this.requestsRepository.update(id, updateData);

    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    const request = await this.findById(id);

    // Delete associated transitions first
    await this.transitionsRepository.delete({ requestId: id });

    await this.requestsRepository.remove(request);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage actions — each validates: active status, correct role,
  //  request at correct prior stage, then sets the timestamp.
  // ─────────────────────────────────────────────────────────────

  /** Validate that a stage action is allowed */
  private validateStageAction(
    request: CarRequest,
    stage: PipelineStage,
    user: ActionUser,
  ): void {
    if (request.status !== RequestStatus.ACTIVE) {
      throw new BadRequestException(
        `Request is not active (current status: ${request.status}). Stage actions are only allowed on active requests.`,
      );
    }

    if (!this.pipelineStageResolver.isRoleAuthorizedForStage(user.role, stage)) {
      throw new ForbiddenException(
        `Your role (${user.role}) is not authorized to perform this action (stage ${stage}).`,
      );
    }

    if (!this.pipelineStageResolver.isRequestAtStage(request, stage)) {
      const current = this.pipelineStageResolver.resolveCurrentStage(request);
      throw new BadRequestException(
        `Request is not at the correct stage for this action. ` +
        `Expected stage ${stage}, but current stage is ${current?.stage ?? 'completed (all done)'}.`,
      );
    }
  }

  /** Record a stage transition entry for audit trail */
  private async recordTransition(
    requestId: number,
    departmentId: number,
    action: 'started' | 'completed',
    userId: number,
  ): Promise<void> {
    try {
      const t = this.transitionsRepository.create({
        requestId,
        departmentId,
        action: action === 'started' ? TransitionAction.STARTED : TransitionAction.COMPLETED,
        actionedBy: userId,
      });
      await this.transitionsRepository.save(t);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === 'ER_DUP_ENTRY'
      ) {
        // Already recorded — that's fine
        return;
      }
      throw error;
    }
  }

  // ── Stage 2: Dispatch Vehicle (NVS) ──

  async dispatchVehicle(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.STORAGE, user);

    const now = new Date();
    await this.requestsRepository.update(id, { storageAt: now });

    // Fire-and-forget notification to QC NVS
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('qc_nvs', 'dispatchVehicle', updated))
      .catch((err) => this.logger.error(`Notification failed (dispatchVehicle): ${err}`));

    this.logger.log(`Request ${id}: Vehicle dispatched by user ${user.id}`);
    return updated;
  }

  // ── Stage 3: Vehicle Received (QC NVS) ──

  async vehicleReceived(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.SHOWROOM, user);

    const now = new Date();
    await this.requestsRepository.update(id, { vehicleReceivedAt: now });

    // Fire-and-forget notification to Mechanical Check
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('mechanical_check', 'vehicleReceived', updated))
      .catch((err) => this.logger.error(`Notification failed (vehicleReceived): ${err}`));

    this.logger.log(`Request ${id}: Vehicle received at showroom by user ${user.id}`);
    return updated;
  }

  // ── Stage 4: Mechanical Check Start ──

  async mechanicalCheckStart(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.MECHANICAL_CHECK, user);

    // Check it hasn't been started already
    if (request.mechanicalCheckStartedAt) {
      throw new ConflictException('Mechanical check has already been started for this request');
    }

    const now = new Date();
    await this.requestsRepository.update(id, { mechanicalCheckStartedAt: now });

    this.logger.log(`Request ${id}: Mechanical check started by user ${user.id}`);
    return this.findById(id);
  }

  // ── Stage 4: Mechanical Check Complete ──

  async mechanicalCheckComplete(
    id: number,
    dto: MechanicalCheckCompleteDto,
    user: ActionUser,
  ): Promise<CarRequest> {
    const request = await this.findById(id);

    if (request.status !== RequestStatus.ACTIVE) {
      throw new BadRequestException('Request is not active');
    }

    // Must have been started
    if (!request.mechanicalCheckStartedAt) {
      throw new BadRequestException('Mechanical check must be started before completing');
    }

    // Must not already be completed
    if (request.mechanicalCheckCompletedAt) {
      throw new ConflictException('Mechanical check has already been completed');
    }

    const now = new Date();
    const duration = Math.round(
      (now.getTime() - request.mechanicalCheckStartedAt.getTime()) / 1000,
    );

    await this.requestsRepository.update(id, {
      mechanicalCheckCompletedAt: now,
      mechanicalCheckDuration: duration,
    });

    // Fire-and-forget notification: PDI if PDI request, else QC NVS
    const updated = await this.findById(id);
    const isPdiRequest = (updated as any).requestType?.value === 'pdi' || (updated as any).requestType?.value === 're_pdi';
    const notifyRole = isPdiRequest ? 'pdi' : 'qc_nvs';
    Promise.resolve()
      .then(() => this.emailService.notifyRole(notifyRole, 'mechanicalCheckComplete', updated))
      .catch((err) => this.logger.error(`Notification failed (mechanicalCheckComplete): ${err}`));

    this.logger.log(`Request ${id}: Mechanical check completed by user ${user.id}`);
    return updated;
  }

  // ── Stage 5: PDI Start ──

  async pdiStart(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.PDI, user);

    if (request.pdiStartedAt) {
      throw new ConflictException('PDI has already been started for this request');
    }

    const now = new Date();
    await this.requestsRepository.update(id, { pdiStartedAt: now });

    this.logger.log(`Request ${id}: PDI started by user ${user.id}`);
    return this.findById(id);
  }

  // ── Stage 5: PDI Complete ──

  async pdiComplete(
    id: number,
    dto: PdiCompleteDto,
    user: ActionUser,
  ): Promise<CarRequest> {
    const request = await this.findById(id);

    if (request.status !== RequestStatus.ACTIVE) {
      throw new BadRequestException('Request is not active');
    }

    if (!request.pdiStartedAt) {
      throw new BadRequestException('PDI must be started before completing');
    }

    if (request.pdiCompletedAt) {
      throw new ConflictException('PDI has already been completed');
    }

    const now = new Date();
    const duration = Math.round(
      (now.getTime() - request.pdiStartedAt.getTime()) / 1000,
    );

    await this.requestsRepository.update(id, {
      pdiCompletedAt: now,
      pdiDuration: duration,
    });

    // Fire-and-forget notification to QC NVS
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('qc_nvs', 'pdiComplete', updated))
      .catch((err) => this.logger.error(`Notification failed (pdiComplete): ${err}`));

    this.logger.log(`Request ${id}: PDI completed by user ${user.id}`);
    return updated;
  }

  // ── Stage 6: Confirm Sent to Accessories (QC NVS) ──

  async confirmSentToAccessories(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.SENT_TO_ACCESSORIES, user);

    if (request.sentToAccessoriesAt) {
      throw new ConflictException('Vehicle has already been marked as sent to accessories');
    }

    const now = new Date();
    await this.requestsRepository.update(id, { sentToAccessoriesAt: now });

    // Fire-and-forget notification to Accessories
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('accessories', 'confirmSentToAccessories', updated))
      .catch((err) => this.logger.error(`Notification failed (confirmSentToAccessories): ${err}`));

    this.logger.log(`Request ${id}: Confirmed sent to accessories by user ${user.id}`);
    return updated;
  }

  // ── Stage 7: Accessories Start ──

  async accessoriesStart(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.ACCESSORIES, user);

    if (request.accessoriesStartedAt) {
      throw new ConflictException('Accessories work has already been started');
    }

    const now = new Date();
    await this.requestsRepository.update(id, { accessoriesStartedAt: now });

    this.logger.log(`Request ${id}: Accessories started by user ${user.id}`);
    return this.findById(id);
  }

  // ── Stage 7: Accessories Complete ──

  async accessoriesComplete(
    id: number,
    dto: AccessoriesCompleteDto,
    user: ActionUser,
  ): Promise<CarRequest> {
    const request = await this.findById(id);

    if (request.status !== RequestStatus.ACTIVE) {
      throw new BadRequestException('Request is not active');
    }

    if (!request.accessoriesStartedAt) {
      throw new BadRequestException('Accessories must be started before completing');
    }

    if (request.accessoriesCompletedAt) {
      throw new ConflictException('Accessories work has already been completed');
    }

    const now = new Date();
    const duration = Math.round(
      (now.getTime() - request.accessoriesStartedAt.getTime()) / 1000,
    );

    await this.requestsRepository.update(id, {
      accessoriesCompletedAt: now,
      accessoriesDuration: duration,
    });

    // Fire-and-forget notification to QC NVS
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('qc_nvs', 'accessoriesComplete', updated))
      .catch((err) => this.logger.error(`Notification failed (accessoriesComplete): ${err}`));

    this.logger.log(`Request ${id}: Accessories completed by user ${user.id}`);
    return updated;
  }

  // ── Stage 8: Final Inspection (QC NVS) ──

  async finalInspection(
    id: number,
    dto: FinalInspectionDto,
    user: ActionUser,
  ): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.FINAL_INSPECTION, user);

    if (request.finalInspectionAt) {
      throw new ConflictException('Final inspection has already been submitted');
    }

    const now = new Date();

    // Determine whether this is a "done" or "archive" outcome
    const fiResult = await this.pipelineStageResolver.resolveFiOutcome(dto.outcome);

    if (!fiResult.archive) {
      // Done outcome — proceed forward
      await this.requestsRepository.update(id, {
        finalInspectionAt: now,
        finalInspectionOutcome: dto.outcome,
        finalInspectionRemarks: dto.remarks ?? undefined,
      } as any);

      // Fire-and-forget notification: mechanical_check if GPS, else registration
      const updated = await this.findById(id);
      const notifyRole = updated.hasGps ? 'mechanical_check' : 'registration';
      Promise.resolve()
        .then(() => this.emailService.notifyRole(notifyRole, 'finalInspection_done', updated))
        .catch((err) => this.logger.error(`Notification failed (finalInspection done): ${err}`));

      this.logger.log(
        `Request ${id}: Final inspection done (${dto.outcome}) by user ${user.id}`,
      );
    } else {
      // Archive outcome — auto-archive via QC
      await this.requestsRepository.update(id, {
        finalInspectionAt: now,
        finalInspectionOutcome: dto.outcome,
        finalInspectionRemarks: dto.remarks ?? undefined,
        status: RequestStatus.ARCHIVED_QC,
      } as any);

      // Fire-and-forget notification to admin (auto) and super_admin
      const updated = await this.findById(id);
      this.emailService.notifyRoles(['super_admin'], 'finalInspection_archive', updated);

      this.logger.log(
        `Request ${id}: Final inspection -> auto-archived (${dto.outcome}) by user ${user.id}`,
      );
    }

    return this.findById(id);
  }

  // ── Stage 9: GPS Confirm (Mechanical Check) ──

  async confirmGpsDone(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.GPS, user);

    if (request.gpsConfirmedAt) {
      throw new ConflictException('GPS has already been confirmed for this request');
    }

    const now = new Date();
    await this.requestsRepository.update(id, { gpsConfirmedAt: now });

    // Fire-and-forget notification to Registration
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('registration', 'confirmGpsDone', updated))
      .catch((err) => this.logger.error(`Notification failed (confirmGpsDone): ${err}`));

    this.logger.log(`Request ${id}: GPS confirmed by user ${user.id}`);
    return updated;
  }

  // ── Stage 10: Register (Registration) ──

  async register(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.REGISTRATION, user);

    if (request.registeredAt) {
      throw new ConflictException('Registration has already been completed');
    }

    const now = new Date();
    await this.requestsRepository.update(id, { registeredAt: now });

    // Fire-and-forget notification to Delivery
    const updated = await this.findById(id);
    Promise.resolve()
      .then(() => this.emailService.notifyRole('delivery', 'register', updated))
      .catch((err) => this.logger.error(`Notification failed (register): ${err}`));

    this.logger.log(`Request ${id}: Registration completed by user ${user.id}`);
    return updated;
  }

  // ── Stage 11: Confirm Delivery (Delivery) ──

  async confirmDelivery(
    id: number,
    dto: ConfirmDeliveryDto,
    user: ActionUser,
  ): Promise<CarRequest> {
    const request = await this.findById(id);
    this.validateStageAction(request, PipelineStage.DELIVERY, user);

    if (request.deliveredAt) {
      throw new ConflictException('Delivery has already been confirmed');
    }

    const now = new Date();
    await this.requestsRepository.update(id, {
      deliveredAt: now,
      deliveryRemarks: dto.remarks ?? undefined,
      completedAt: now,
    } as any);

    this.logger.log(`Request ${id}: Delivery confirmed by user ${user.id}`);
    return this.findById(id);
  }

  // ─────────────────────────────────────────────────────────────
  //  Cancel / Archive / Reactivate
  // ─────────────────────────────────────────────────────────────

  async cancel(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);

    // Only Admin or Super Admin can cancel
    const roleLower = user.role.toLowerCase();
    if (roleLower !== 'super_admin' && roleLower !== 'admin') {
      throw new ForbiddenException('Only Admin or Super Admin can cancel requests');
    }

    if (
      request.status === RequestStatus.CANCELLED ||
      request.status === RequestStatus.ARCHIVED_MANUAL ||
      request.status === RequestStatus.ARCHIVED_QC
    ) {
      throw new BadRequestException(
        `Cannot cancel a request that is already ${request.status}`,
      );
    }

    await this.requestsRepository.update(id, {
      status: RequestStatus.CANCELLED,
    });

    // Fire-and-forget notification to admin (auto) and super_admin
    const updated = await this.findById(id);
    this.emailService.notifyRoles(['super_admin'], 'cancel', updated);

    this.logger.log(`Request ${id}: Cancelled by user ${user.id}`);
    return updated;
  }

  async archive(id: number, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);

    // Only Admin or Super Admin can manually archive
    const roleLower = user.role.toLowerCase();
    if (roleLower !== 'super_admin' && roleLower !== 'admin') {
      throw new ForbiddenException('Only Admin or Super Admin can archive requests');
    }

    if (
      request.status === RequestStatus.CANCELLED ||
      request.status === RequestStatus.ARCHIVED_MANUAL ||
      request.status === RequestStatus.ARCHIVED_QC
    ) {
      throw new BadRequestException(
        `Cannot archive a request that is already ${request.status}`,
      );
    }

    await this.requestsRepository.update(id, {
      status: RequestStatus.ARCHIVED_MANUAL,
    });

    // Fire-and-forget notification to admin and super_admin
    const updated = await this.findById(id);
    this.emailService.notifyRoles(['super_admin'], 'archive', updated);

    this.logger.log(`Request ${id}: Manually archived by user ${user.id}`);
    return updated;
  }

  async reactivate(id: number, dto: ReactivateDto, user: ActionUser): Promise<CarRequest> {
    const request = await this.findById(id);

    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Cancelled requests cannot be reactivated');
    }

    if (request.status === RequestStatus.ACTIVE) {
      throw new BadRequestException('Request is already active');
    }

    // QC-archived: only QC NVS or Super Admin can re-open
    if (request.status === RequestStatus.ARCHIVED_QC) {
      const roleLower = user.role.toLowerCase();
      if (roleLower !== 'super_admin' && roleLower !== 'qc_nvs') {
        throw new ForbiddenException(
          'Only QC NVS or Super Admin can re-open a QC-archived request',
        );
      }

      // Re-open by clearing the final inspection result
      // and setting status back to active so Final Inspection can be re-submitted
      await this.requestsRepository.update(id, {
        status: RequestStatus.ACTIVE,
        finalInspectionAt: undefined as any,
        finalInspectionOutcome: undefined as any,
        finalInspectionRemarks: undefined as any,
      } as any);

      this.logger.log(`Request ${id}: QC-archived re-opened by user ${user.id}`);
      return this.findById(id);
    }

    // Manually archived: only Admin or Super Admin can re-open
    if (request.status === RequestStatus.ARCHIVED_MANUAL) {
      const roleLower = user.role.toLowerCase();
      if (roleLower !== 'super_admin' && roleLower !== 'admin') {
        throw new ForbiddenException(
          'Only Admin or Super Admin can re-activate a manually archived request',
        );
      }

      const updateData: Record<string, any> = {
        status: RequestStatus.ACTIVE,
      };

      if (dto.resetDates) {
        // Reset promise_date to today + working days based on request type
        const promiseDate = await this.calculatePromiseDate(
          request.requestTypeId,
          request.accessories,
        );
        updateData.promiseDate = promiseDate;
      }
      // If not resetting, the original promise_date and created_at stay as-is

      await this.requestsRepository.update(id, updateData);

      this.logger.log(
        `Request ${id}: Manually archived reactivated (resetDates=${dto.resetDates}) by user ${user.id}`,
      );
      return this.findById(id);
    }

    throw new BadRequestException('Unknown request status for reactivation');
  }

  // ─────────────────────────────────────────────────────────────
  //  Export CSV
  // ─────────────────────────────────────────────────────────────

  async exportCsv(period: ExportPeriod): Promise<string> {
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

    const qb = this.requestsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestType', 'requestType')
      .leftJoinAndSelect('r.brand', 'brand')
      .leftJoinAndSelect('r.model', 'model')
      .leftJoinAndSelect('r.variant', 'variant')
      .leftJoinAndSelect('r.exteriorColor', 'exteriorColor')
      .leftJoinAndSelect('r.interiorColor', 'interiorColor')
      .leftJoinAndSelect('r.showroom', 'showroom')
      .leftJoinAndSelect('r.salesConsultant', 'salesConsultant')
      .leftJoinAndSelect('r.salesType', 'salesType')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.transitions', 'transitions')
      .leftJoinAndSelect('transitions.department', 'transitionDepartment')
      .leftJoinAndSelect('transitions.actionedByUser', 'actionedByUser')
      .orderBy('r.createdAt', 'DESC');

    if (dateFrom) {
      qb.andWhere('r.createdAt >= :dateFrom', { dateFrom });
    }

    const items = await qb.getMany();

    const esc = (value: unknown): string => {
      const str = value == null ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      'Request Number',
      'Chassis Number (VIN)',
      'Request Type',
      'Brand',
      'Model',
      'Variant',
      'Exterior Color',
      'Interior Color',
      'Vehicle Location',
      'Showroom',
      'Customer Name',
      'Customer Phone',
      'Sales Consultant',
      'Sales Type',
      'GPS',
      'Promise Date',
      'Status',
      'Storage At',
      'Vehicle Received At',
      'Mechanical Check At',
      'PDI At',
      'Accessories At',
      'Final Inspection At',
      'Final Inspection Outcome',
      'GPS Confirmed At',
      'Registered At',
      'Delivered At',
      'Created At',
      'Completed At',
      'Remarks',
    ];

    const rows = items.map((r) => [
      esc(r.requestNumber),
      esc(r.chassisNumber),
      esc(r.requestType?.label ?? ''),
      esc(r.brand?.label ?? ''),
      esc(r.model?.label ?? ''),
      esc(r.variant?.label ?? ''),
      esc(r.exteriorColor?.label ?? ''),
      esc(r.interiorColor?.label ?? ''),
      esc(r.vehicleLocation),
      esc(r.showroom?.label ?? ''),
      esc(r.customerName),
      esc(r.customerPhone),
      esc(r.salesConsultant?.label ?? ''),
      esc(r.salesType?.label ?? ''),
      esc(r.hasAccessories ? 'Yes' : 'No'),
      esc(r.hasGps ? 'Yes' : 'No'),
      esc(r.promiseDate?.toISOString() ?? ''),
      esc(r.status),
      esc(r.storageAt?.toISOString() ?? ''),
      esc(r.vehicleReceivedAt?.toISOString() ?? ''),
      esc(r.mechanicalCheckCompletedAt?.toISOString() ?? ''),
      esc(r.pdiCompletedAt?.toISOString() ?? ''),
      esc(r.accessoriesCompletedAt?.toISOString() ?? ''),
      esc(r.finalInspectionAt?.toISOString() ?? ''),
      esc(r.finalInspectionOutcome ?? ''),
      esc(r.gpsConfirmedAt?.toISOString() ?? ''),
      esc(r.registeredAt?.toISOString() ?? ''),
      esc(r.deliveredAt?.toISOString() ?? ''),
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

  async exportXlsx(period: ExportPeriod): Promise<Buffer> {
    const now = new Date();
    let dateFrom: Date | undefined;
    switch (period) {
      case 'week': dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'year': dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: dateFrom = undefined;
    }

    const qb = this.requestsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requestType', 'requestType')
      .leftJoinAndSelect('r.brand', 'brand')
      .leftJoinAndSelect('r.model', 'model')
      .leftJoinAndSelect('r.variant', 'variant')
      .leftJoinAndSelect('r.exteriorColor', 'exteriorColor')
      .leftJoinAndSelect('r.interiorColor', 'interiorColor')
      .leftJoinAndSelect('r.showroom', 'showroom')
      .leftJoinAndSelect('r.salesConsultant', 'salesConsultant')
      .leftJoinAndSelect('r.salesType', 'salesType')
      .orderBy('r.createdAt', 'DESC');

    if (dateFrom) qb.andWhere('r.createdAt >= :dateFrom', { dateFrom });
    const items = await qb.getMany();

    const fmtDate = (d: Date | null | undefined) =>
      d ? d.toISOString().split('T')[0] + ' ' + d.toTimeString().slice(0, 5) : '';

    const data = items.map((r) => ({
      requestNumber: r.requestNumber,
      chassisNumber: r.chassisNumber,
      requestType: r.requestType?.label ?? '',
      brand: r.brand?.label ?? '',
      model: r.model?.label ?? '',
      variant: r.variant?.label ?? '',
      exteriorColor: r.exteriorColor?.label ?? '',
      interiorColor: r.interiorColor?.label ?? '',
      vehicleLocation: r.vehicleLocation ?? '',
      showroom: r.showroom?.label ?? '',
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      salesConsultant: r.salesConsultant?.label ?? '',
      salesType: r.salesType?.label ?? '',
      hasAccessories: r.hasAccessories ? 'Yes' : 'No',
      hasGps: r.hasGps ? 'Yes' : 'No',
      promiseDate: fmtDate(r.promiseDate),
      status: r.status,
      storageAt: fmtDate(r.storageAt),
      vehicleReceivedAt: fmtDate(r.vehicleReceivedAt),
      mechanicalCheckAt: fmtDate(r.mechanicalCheckCompletedAt),
      pdiAt: fmtDate(r.pdiCompletedAt),
      sentToAccessoriesAt: fmtDate(r.sentToAccessoriesAt),
      accessoriesAt: fmtDate(r.accessoriesCompletedAt),
      finalInspectionAt: fmtDate(r.finalInspectionAt),
      finalInspectionOutcome: r.finalInspectionOutcome ?? '',
      gpsConfirmedAt: fmtDate(r.gpsConfirmedAt),
      registeredAt: fmtDate(r.registeredAt),
      deliveredAt: fmtDate(r.deliveredAt),
      createdAt: fmtDate(r.createdAt),
      remarks: r.remarks ?? '',
    }));

    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'export-xlsx.py');
    const logoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'logos', 'BYD-OTP-DESK_full-logo.png');

    const input = JSON.stringify({ period, data, logoPath });
    const proc = spawnSync('python3', [scriptPath], { input, maxBuffer: 50 * 1024 * 1024 });

    if (proc.error || proc.status !== 0) {
      this.logger.error(`XLSX export failed: ${proc.stderr?.toString()}`);
      throw new Error('Failed to generate XLSX file');
    }

    return proc.stdout;
  }
}
