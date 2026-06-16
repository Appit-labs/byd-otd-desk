import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import {
  CarRequest,
  RequestStatus,
} from '../database/entities/car-request.entity.js';
import {
  RequestStageTransition,
  TransitionAction,
} from '../database/entities/request-stage-transition.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { UserRole } from '../database/entities/user.entity.js';
import { canRoleTransitionDepartment } from '../common/permissions/permission-matrix.js';

export interface BulkTransitionResult {
  success: number;
  failed: { requestId: number; reason: string }[];
}

export interface TransitionUser {
  id: number;
  role: string;
  departmentId: number | null;
}

@Injectable()
export class StageTransitionsService {
  private readonly logger = new Logger(StageTransitionsService.name);

  constructor(
    @InjectRepository(CarRequest)
    private requestsRepository: Repository<CarRequest>,
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
    @InjectRepository(RequestStageTransition)
    private transitionsRepository: Repository<RequestStageTransition>,
    private dataSource: DataSource,
  ) {}

  async transition(
    requestId: number,
    departmentId: number,
    action: 'started' | 'completed',
    user: TransitionUser,
  ): Promise<RequestStageTransition> {
    return this.dataSource.transaction(async (entityManager) => {
      // 1. Fetch car request
      const request = await entityManager.findOne(CarRequest, {
        where: { id: requestId },
      });
      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // 2. Block transitions when not active
      if (request.status !== RequestStatus.ACTIVE) {
        throw new BadRequestException(
          `Request is not active (status: ${request.status}). Stage transitions are only allowed on active requests.`,
        );
      }

      // 3. Fetch department
      const department = await entityManager.findOne(Department, {
        where: { id: departmentId },
      });
      if (!department) {
        throw new NotFoundException('Department not found');
      }

      // 4. Validate user authorization
      this.validateAuthorization(user, department);

      // 5. Execute based on action
      if (action === 'started') {
        return this.handleStart(
          entityManager,
          request,
          department,
          user,
        );
      } else {
        return this.handleComplete(
          entityManager,
          request,
          department,
          user,
        );
      }
    });
  }

  async bulkTransition(
    requestIds: number[],
    departmentId: number,
    action: 'started' | 'completed',
    user: TransitionUser,
  ): Promise<BulkTransitionResult> {
    // Validate department first (outside loop)
    const department = await this.departmentsRepository.findOne({
      where: { id: departmentId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Validate user authorization once
    this.validateAuthorization(user, department);

    const result: BulkTransitionResult = { success: 0, failed: [] };

    for (const requestId of requestIds) {
      try {
        await this.transition(requestId, departmentId, action, user);
        result.success++;
      } catch (error) {
        // Collect failure reason without throwing
        const reason =
          error instanceof Error ? error.message : 'Unknown error';
        result.failed.push({ requestId, reason });
        this.logger.warn(
          `Bulk transition failed for request ${requestId}: ${reason}`,
        );
      }
    }

    return result;
  }

  private validateAuthorization(
    user: TransitionUser,
    department: Department,
  ): void {
    // Super admin can transition any department
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // Admin cannot perform any stage actions
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Admin users are not authorized to perform stage transitions',
      );
    }

    // Check permission matrix: does the user's role allow transitions on this department?
    if (canRoleTransitionDepartment(user.role as UserRole, department.slug)) {
      return;
    }

    throw new ForbiddenException(
      `Your role (${user.role}) is not authorized to perform transitions for department "${department.name}"`,
    );
  }

  private async handleStart(
    entityManager: any,
    request: CarRequest,
    department: Department,
    user: TransitionUser,
  ): Promise<RequestStageTransition> {
    // Rule: check if 'started' already exists (avoid unique constraint error)
    const existing = await entityManager.findOne(RequestStageTransition, {
      where: {
        requestId: request.id,
        departmentId: department.id,
        action: TransitionAction.STARTED,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Stage "${department.name}" has already been started for this request`,
      );
    }

    // Stage ordering: if not first stage, check previous stage is completed
    if (department.pipelineOrder > 1) {
      const prevDepartment = await entityManager.findOne(Department, {
        where: { pipelineOrder: department.pipelineOrder - 1 },
      });
      if (!prevDepartment) {
        throw new BadRequestException(
          'Previous department in pipeline not found',
        );
      }

      const prevCompleted = await entityManager.findOne(
        RequestStageTransition,
        {
          where: {
            requestId: request.id,
            departmentId: prevDepartment.id,
            action: TransitionAction.COMPLETED,
          },
        },
      );
      if (!prevCompleted) {
        throw new BadRequestException(
          `Cannot start "${department.name}". Previous stage "${prevDepartment.name}" must be completed first.`,
        );
      }
    }

    // Insert transition
    const transition = entityManager.create(RequestStageTransition, {
      requestId: request.id,
      departmentId: department.id,
      action: TransitionAction.STARTED,
      actionedBy: user.id,
    });

    let savedTransition: RequestStageTransition;
    try {
      savedTransition = await entityManager.save(
        RequestStageTransition,
        transition,
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(
          `Stage "${department.name}" has already been started for this request`,
        );
      }
      throw error;
    }

    // Auto-status: first transition confirms active
    // (status is already set to active on creation, so this is a no-op now)
    // Status remains active throughout; the new pipeline stages use timestamp fields

    return savedTransition;
  }

  private async handleComplete(
    entityManager: any,
    request: CarRequest,
    department: Department,
    user: TransitionUser,
  ): Promise<RequestStageTransition> {
    // Rule: verify 'started' exists before completing
    const started = await entityManager.findOne(RequestStageTransition, {
      where: {
        requestId: request.id,
        departmentId: department.id,
        action: TransitionAction.STARTED,
      },
    });
    if (!started) {
      throw new BadRequestException(
        `Cannot complete "${department.name}". Stage must be started first.`,
      );
    }

    // Check if 'completed' already exists
    const existingCompleted = await entityManager.findOne(
      RequestStageTransition,
      {
        where: {
          requestId: request.id,
          departmentId: department.id,
          action: TransitionAction.COMPLETED,
        },
      },
    );
    if (existingCompleted) {
      throw new ConflictException(
        `Stage "${department.name}" has already been completed for this request`,
      );
    }

    // Insert transition
    const transition = entityManager.create(RequestStageTransition, {
      requestId: request.id,
      departmentId: department.id,
      action: TransitionAction.COMPLETED,
      actionedBy: user.id,
    });

    let savedTransition: RequestStageTransition;
    try {
      savedTransition = await entityManager.save(
        RequestStageTransition,
        transition,
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(
          `Stage "${department.name}" has already been completed for this request`,
        );
      }
      throw error;
    }

    // Status stays active; completion is tracked via the new pipeline timestamp fields
    // on the car_requests table, not via status enum changes.

    return savedTransition;
  }
}
