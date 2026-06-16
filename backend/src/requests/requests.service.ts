import * as ExcelJS from 'exceljs';
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

    // ═══════════════════════════════════════════════════════════
    //  Build Professional XLSX with exceljs
    // ═══════════════════════════════════════════════════════════
    try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BYD OTD Desk';
    wb.created = new Date();
    const ws = wb.addWorksheet('OTD Requests');

    // ── Design tokens ──
    const NAVY = 'FF1E293B';
    const NAVY_LIGHT = 'FF334155';
    const RED = 'FFDC2626';
    const BLUE = 'FF00C2FF';
    const TEAL = 'FF0FF4C6';
    const WHITE = 'FFFFFFFF';
    const OFF_WHITE = 'FFF8FAFC';
    const GRAY_50 = 'FFF9FAFB';
    const GRAY_100 = 'FFF3F4F6';
    const GRAY_200 = 'FFE5E7EB';
    const GRAY_400 = 'FF9CA3AF';
    const GRAY_600 = 'FF4B5563';
    const GRAY_800 = 'FF1F2937';
    const GREEN = 'FF059669';
    const AMBER = 'FFD97706';

    const headers = [
      'Request #', 'Chassis (VIN)', 'Type', 'Brand', 'Model', 'Variant',
      'Ext. Color', 'Int. Color', 'Location', 'Showroom',
      'Customer', 'Phone', 'Consultant', 'Sales Type',
      'Acc.', 'GPS', 'Promise Date', 'Status',
      'Storage', 'Received', 'Mech. Check', 'PDI',
      'To Acc.', 'Accessories', 'Final Insp.', 'FI Outcome',
      'GPS Done', 'Registered', 'Delivered', 'Created', 'Remarks',
    ];
    const COL_COUNT = headers.length; // 31

    // ── Row 1: Top accent bar (thin red line) ──
    ws.getRow(1).height = 4;
    for (let c = 1; c <= COL_COUNT; c++) {
      ws.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
      ws.getCell(1, c).border = { bottom: { style: 'thin', color: { argb: RED } } };
    }

    // ── Row 2-3: Title block with navy background ──
    ws.mergeCells(2, 1, 2, COL_COUNT);
    ws.getCell('A2').value = 'BYD OTD DESK';
    ws.getCell('A2').font = { name: 'Calibri', size: 20, bold: true, color: { argb: WHITE } };
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(2).height = 40;

    ws.mergeCells(3, 1, 3, COL_COUNT);
    ws.getCell('A3').value = 'Order to Delivery — Tracker Export';
    ws.getCell('A3').font = { name: 'Calibri', size: 11, color: { argb: GRAY_400 } };
    ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(3).height = 24;

    // ── Row 4: Separator ──
    ws.getRow(4).height = 3;

    // ── Row 5: Metadata bar ──
    const periodLabel: Record<string, string> = { week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
    ws.mergeCells(5, 1, 5, COL_COUNT);
    ws.getCell('A5').value = `${periodLabel[period] ?? period}  •  ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  •  ${items.length} request${items.length !== 1 ? 's' : ''}  •  Generated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    ws.getCell('A5').font = { name: 'Calibri', size: 9, color: { argb: GRAY_600 } };
    ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_50 } };
    ws.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(5).height = 22;

    // ── Row 6: Spacer ──
    ws.getRow(6).height = 8;

    // ── Row 7: Column headers ──
    const HEADER_ROW = 7;
    ws.getRow(HEADER_ROW).height = 42;
    headers.forEach((h, i) => {
      const cell = ws.getCell(HEADER_ROW, i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: NAVY } },
        bottom: { style: 'medium', color: { argb: BLUE } },
        left: { style: 'thin', color: { argb: NAVY_LIGHT } },
        right: { style: 'thin', color: { argb: NAVY_LIGHT } },
      };
    });

    // ── Data rows ──
    items.forEach((r, idx) => {
      const row = HEADER_ROW + 1 + idx;
      const isEven = idx % 2 === 0;
      const bg = isEven ? WHITE : OFF_WHITE;
      const vals = [
        r.requestNumber, r.chassisNumber, r.requestType?.label ?? '', r.brand?.label ?? '',
        r.model?.label ?? '', r.variant?.label ?? '', r.exteriorColor?.label ?? '',
        r.interiorColor?.label ?? '', r.vehicleLocation ?? '', r.showroom?.label ?? '',
        r.customerName, r.customerPhone, r.salesConsultant?.label ?? '', r.salesType?.label ?? '',
        r.hasAccessories ? '✓' : '—', r.hasGps ? '✓' : '—',
        fmtDate(r.promiseDate), r.status,
        fmtDate(r.storageAt), fmtDate(r.vehicleReceivedAt), fmtDate(r.mechanicalCheckCompletedAt),
        fmtDate(r.pdiCompletedAt), fmtDate(r.sentToAccessoriesAt), fmtDate(r.accessoriesCompletedAt),
        fmtDate(r.finalInspectionAt), r.finalInspectionOutcome ?? '', fmtDate(r.gpsConfirmedAt),
        fmtDate(r.registeredAt), fmtDate(r.deliveredAt), fmtDate(r.createdAt), r.remarks ?? '',
      ];
      vals.forEach((v, col) => {
        const cell = ws.getCell(row, col + 1);
        cell.value = v ?? '';
        cell.font = { name: 'Calibri', size: 10, color: { argb: GRAY_800 } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'hair', color: { argb: GRAY_200 } },
          bottom: { style: 'hair', color: { argb: GRAY_200 } },
          left: { style: 'hair', color: { argb: GRAY_200 } },
          right: { style: 'hair', color: { argb: GRAY_200 } },
        };
        // Request number — accent color
        if (col === 0) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BLUE } };
        // Status badge
        if (col === 17) {
          const s = String(v).toLowerCase();
          if (s === 'active') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: GREEN } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFECFDF5' } };
          } else if (s.includes('cancel')) {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: RED } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFEF2F2' : 'FFFEE2E2' } };
          } else if (s.includes('archived')) {
            cell.font = { name: 'Calibri', size: 10, color: { argb: GRAY_600 } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFF3F4F6' } };
          }
        }
        // Checkmark styling
        if ((col === 14 || col === 15) && v === '✓') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: GREEN } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if ((col === 14 || col === 15) && v === '—') {
          cell.font = { name: 'Calibri', size: 10, color: { argb: GRAY_400 } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });

    const dataEndRow = HEADER_ROW + items.length;

    // ── Column widths ──
    [17,22,10,12,14,12,13,13,17,20,20,15,17,14,6,6,15,14,15,15,15,14,14,15,15,18,15,15,15,15,28].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    // ── Freeze panes + auto-filter ──
    ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: dataEndRow, column: COL_COUNT } };

    // ── Summary row ──
    const summaryRow = dataEndRow + 2;
    ws.getRow(summaryRow).height = 28;
    ws.mergeCells(summaryRow, 1, summaryRow, 4);
    ws.getCell(summaryRow, 1).value = 'SUMMARY';
    ws.getCell(summaryRow, 1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
    ws.getCell(summaryRow, 1).alignment = { horizontal: 'left', vertical: 'middle' };
    const activeCount = items.filter(r => r.status === 'active').length;
    const cancelledCount = items.filter(r => r.status === 'cancelled').length;
    const archivedCount = items.filter(r => r.status?.startsWith('archived')).length;
    ws.mergeCells(summaryRow, 5, summaryRow, COL_COUNT);
    ws.getCell(summaryRow, 5).value = `Active: ${activeCount}  •  Cancelled: ${cancelledCount}  •  Archived: ${archivedCount}  •  Total: ${items.length}`;
    ws.getCell(summaryRow, 5).font = { name: 'Calibri', size: 10, color: { argb: GRAY_600 } };
    ws.getCell(summaryRow, 5).alignment = { horizontal: 'right', vertical: 'middle' };

    // ── Footer ──
    const footerRow = summaryRow + 2;
    ws.getRow(footerRow).height = 20;
    ws.mergeCells(footerRow, 1, footerRow, COL_COUNT);
    ws.getCell(footerRow, 1).value = 'BYD OTD Desk  •  Confidential  •  © ' + new Date().getFullYear();
    ws.getCell(footerRow, 1).font = { name: 'Calibri', size: 8, color: { argb: GRAY_400 }, italic: true };
    ws.getCell(footerRow, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(footerRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_50 } };

    // ── Print setup ──
    ws.pageSetup.orientation = 'landscape';
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 0;
    ws.pageSetup.paperSize = 9; // A4
    ws.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 };
    ws.headerFooter.oddFooter = '&B&08BYD OTD Desk — Page &P of &N';

      return Buffer.from(await wb.xlsx.writeBuffer());
    } catch (err) {
      this.logger.error(`XLSX generation failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
