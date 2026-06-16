import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CarRequest } from '../database/entities/car-request.entity.js';
import { PipelineStage, RequestStatus } from '../database/entities/car-request.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';
import { Setting } from '../database/entities/setting.entity.js';

/**
 * Standard pipeline stage definition.
 */
export interface StageDefinition {
  stage: PipelineStage;
  name: string;
  /** Which timestamp field must be filled for this stage to be "done" */
  completionField: keyof CarRequest;
  /** Description for UI/audit */
  description: string;
}

/**
 * All 11 stages in pipeline order.
 */
export const PIPELINE_STAGES: StageDefinition[] = [
  {
    stage: PipelineStage.CREATED,
    name: 'Created / Waiting for Storage',
    completionField: 'createdAt', // always filled
    description: 'Request created by Admin / Super Admin',
  },
  {
    stage: PipelineStage.STORAGE,
    name: 'Storage',
    completionField: 'storageAt',
    description: 'NVS dispatches vehicle',
  },
  {
    stage: PipelineStage.SHOWROOM,
    name: 'Showroom (Vehicle Received)',
    completionField: 'vehicleReceivedAt',
    description: 'QC NVS confirms vehicle received at showroom',
  },
  {
    stage: PipelineStage.MECHANICAL_CHECK,
    name: 'Mechanical Check',
    completionField: 'mechanicalCheckCompletedAt',
    description: 'Mechanical Check completes inspection',
  },
  {
    stage: PipelineStage.PDI,
    name: 'PDI',
    completionField: 'pdiCompletedAt',
    description: 'PDI completes pre-delivery inspection',
  },
  {
    stage: PipelineStage.SENT_TO_ACCESSORIES,
    name: 'Sent to Accessories',
    completionField: 'sentToAccessoriesAt',
    description: 'QC NVS confirms vehicle sent to accessories',
  },
  {
    stage: PipelineStage.ACCESSORIES,
    name: 'Accessories',
    completionField: 'accessoriesCompletedAt',
    description: 'Accessories department completes fitting',
  },
  {
    stage: PipelineStage.FINAL_INSPECTION,
    name: 'Final Inspection (QC)',
    completionField: 'finalInspectionAt',
    description: 'QC NVS performs final inspection',
  },
  {
    stage: PipelineStage.GPS,
    name: 'GPS',
    completionField: 'gpsConfirmedAt',
    description: 'Mechanical Check confirms GPS installation',
  },
  {
    stage: PipelineStage.REGISTRATION,
    name: 'Registration',
    completionField: 'registeredAt',
    description: 'Registration completes vehicle registration',
  },
  {
    stage: PipelineStage.DELIVERY,
    name: 'Delivery',
    completionField: 'deliveredAt',
    description: 'Delivery confirms vehicle handed over',
  },
];

/**
 * Fallback hardcoded FI outcome lists — used only when the database
 * does not yet contain the final_inspection setting (e.g. before seeding).
 */
const FALLBACK_FI_DONE_OUTCOMES = ['Good condition', 'Release as is', 'Sales team / manager to check'];
const FALLBACK_FI_ARCHIVE_OUTCOMES = ['Return to fin', 'Return the car (take time)'];

/** Backward-compatible exports for existing imports */
export const FI_DONE_OUTCOMES = FALLBACK_FI_DONE_OUTCOMES;
export const FI_ARCHIVE_OUTCOMES = FALLBACK_FI_ARCHIVE_OUTCOMES;

/**
 * Synchronous fallback functions that use the hardcoded lists.
 * Prefer the async methods on PipelineStageResolverService when inside NestJS context.
 */
export function isFiDoneOutcome(outcome: string): boolean {
  return FI_DONE_OUTCOMES.some(
    (o) => o.toLowerCase() === outcome.toLowerCase(),
  );
}

export function isFiArchiveOutcome(outcome: string): boolean {
  return FI_ARCHIVE_OUTCOMES.some(
    (o) => o.toLowerCase() === outcome.toLowerCase(),
  );
}

/**
 * Request type value to whether PDI applies.
 * - pdi → PDI stage applies; accessories stages apply only if accessories selected
 * - re_pdi / no_pdi → PDI and accessories stages skipped entirely
 */
export function requestTypeHasPdi(requestTypeValue: string | undefined): boolean {
  return requestTypeValue === 'pdi';
}

/**
 * Role mappings for each stage action.
 * Maps which roles can perform which stage actions.
 * Must stay in sync with permission-matrix.ts.
 */
export const STAGE_ROLE_MAP: Partial<Record<PipelineStage, string[]>> = {
  [PipelineStage.STORAGE]: ['super_admin', 'nvs'],
  [PipelineStage.SHOWROOM]: ['super_admin', 'qc_nvs'],
  [PipelineStage.MECHANICAL_CHECK]: ['super_admin', 'mechanical_check'],
  [PipelineStage.PDI]: ['super_admin', 'pdi'],
  [PipelineStage.SENT_TO_ACCESSORIES]: ['super_admin', 'qc_nvs'],
  [PipelineStage.ACCESSORIES]: ['super_admin', 'accessories'],
  [PipelineStage.FINAL_INSPECTION]: ['super_admin', 'qc_nvs'],
  [PipelineStage.GPS]: ['super_admin', 'mechanical_check'],
  [PipelineStage.REGISTRATION]: ['super_admin', 'registration'],
  [PipelineStage.DELIVERY]: ['super_admin', 'delivery'],
};

@Injectable()
export class PipelineStageResolverService {
  constructor(
    @InjectRepository(SettingOption)
    private readonly optionsRepository: Repository<SettingOption>,
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  /**
   * Dynamic check: is this outcome a "done" outcome?
   * Reads from the final_inspection setting, falls back to hardcoded values.
   */
  async isFiDoneOutcome(outcome: string): Promise<boolean> {
    const doneOutcomes = await this.getFiDoneOutcomes();
    return doneOutcomes.some(
      (o) => o.toLowerCase() === outcome.toLowerCase(),
    );
  }

  /**
   * Dynamic check: is this outcome an "archive" outcome?
   * Reads from the final_inspection setting, falls back to hardcoded values.
   */
  async isFiArchiveOutcome(outcome: string): Promise<boolean> {
    const archiveOutcomes = await this.getFiArchiveOutcomes();
    return archiveOutcomes.some(
      (o) => o.toLowerCase() === outcome.toLowerCase(),
    );
  }

  /**
   * Resolve a Final Inspection outcome: returns the appropriate action.
   * Returns { archive: true } for archive outcomes, { archive: false } for done.
   * Returns { archive: true } for unrecognized outcomes that look like archive.
   */
  async resolveFiOutcome(outcome: string): Promise<{ archive: boolean }> {
    if (await this.isFiDoneOutcome(outcome)) {
      return { archive: false };
    }
    if (await this.isFiArchiveOutcome(outcome)) {
      return { archive: true };
    }
    // Unknown outcome — treat as archive if it looks like one
    const looksLikeArchive =
      outcome.toLowerCase().includes('return') ||
      outcome.toLowerCase().includes('archive');
    return { archive: looksLikeArchive };
  }

  /**
   * Load done-labeled outcomes from the database.
   */
  private async getFiDoneOutcomes(): Promise<string[]> {
    try {
      const setting = await this.settingsRepository.findOne({
        where: { key: 'final_inspection' },
      });
      if (!setting) return FALLBACK_FI_DONE_OUTCOMES;

      const options = await this.optionsRepository.find({
        where: { settingId: setting.id, isActive: true },
      });
      if (!options.length) return FALLBACK_FI_DONE_OUTCOMES;

      const done = options
        .filter((o) => o.metadata?.outcome_behavior === 'done')
        .map((o) => o.label);
      return done.length > 0 ? done : FALLBACK_FI_DONE_OUTCOMES;
    } catch {
      return FALLBACK_FI_DONE_OUTCOMES;
    }
  }

  /**
   * Load archive-labeled outcomes from the database.
   */
  private async getFiArchiveOutcomes(): Promise<string[]> {
    try {
      const setting = await this.settingsRepository.findOne({
        where: { key: 'final_inspection' },
      });
      if (!setting) return FALLBACK_FI_ARCHIVE_OUTCOMES;

      const options = await this.optionsRepository.find({
        where: { settingId: setting.id, isActive: true },
      });
      if (!options.length) return FALLBACK_FI_ARCHIVE_OUTCOMES;

      const archive = options
        .filter((o) => o.metadata?.outcome_behavior === 'archive')
        .map((o) => o.label);
      return archive.length > 0 ? archive : FALLBACK_FI_ARCHIVE_OUTCOMES;
    } catch {
      return FALLBACK_FI_ARCHIVE_OUTCOMES;
    }
  }

  /**
   * Get the ordered list of applicable pipeline stages for a given request,
   * considering conditional routing (PDI, Accessories, GPS).
   */
  getApplicableStages(request: CarRequest): StageDefinition[] {
    const requestTypeValue = request.requestType?.value;
    const hasPdi = requestTypeHasPdi(requestTypeValue);
    const hasAccessories = request.hasAccessories === true;
    const hasGps = request.hasGps === true;

    const applicable: StageDefinition[] = [];

    for (const stage of PIPELINE_STAGES) {
      // Stage 1 (Created) always applies
      if (stage.stage === PipelineStage.CREATED) {
        applicable.push(stage);
        continue;
      }

      // Stage 2 (Storage) always applies
      if (stage.stage === PipelineStage.STORAGE) {
        applicable.push(stage);
        continue;
      }

      // Stage 3 (Showroom) always applies
      if (stage.stage === PipelineStage.SHOWROOM) {
        applicable.push(stage);
        continue;
      }

      // Stage 4 (Mechanical Check) always applies
      if (stage.stage === PipelineStage.MECHANICAL_CHECK) {
        applicable.push(stage);
        continue;
      }

      // Stage 5 (PDI) — only if request type is pdi
      if (stage.stage === PipelineStage.PDI) {
        if (hasPdi) applicable.push(stage);
        continue;
      }

      // Stage 6 (Sent to Accessories) — only if PDI and has accessories
      if (stage.stage === PipelineStage.SENT_TO_ACCESSORIES) {
        if (hasAccessories) applicable.push(stage);
        continue;
      }

      // Stage 7 (Accessories) — only if PDI and has accessories
      if (stage.stage === PipelineStage.ACCESSORIES) {
        if (hasAccessories) applicable.push(stage);
        continue;
      }

      // Stage 8 (Final Inspection) always applies
      if (stage.stage === PipelineStage.FINAL_INSPECTION) {
        applicable.push(stage);
        continue;
      }

      // Stage 9 (GPS) — only if has_gps=true
      if (stage.stage === PipelineStage.GPS) {
        if (hasGps) applicable.push(stage);
        continue;
      }

      // Stage 10 (Registration) always applies
      if (stage.stage === PipelineStage.REGISTRATION) {
        applicable.push(stage);
        continue;
      }

      // Stage 11 (Delivery) always applies
      if (stage.stage === PipelineStage.DELIVERY) {
        applicable.push(stage);
        continue;
      }
    }

    return applicable;
  }

  /**
   * Determine the current stage of a request.
   * Returns the first stage whose completion field is null (or undefined).
   * Returns null if all stages are complete (delivered).
   */
  resolveCurrentStage(request: CarRequest): StageDefinition | null {
    const stages = this.getApplicableStages(request);

    for (const stage of stages) {
      const fieldValue = request[stage.completionField];
      if (fieldValue === null || fieldValue === undefined) {
        return stage;
      }
    }

    return null; // All stages complete → delivered
  }

  /**
   * Check if a request is at (or before) a given stage.
   * Used to validate that a stage action is being called at the right time.
   */
  isRequestAtStage(request: CarRequest, targetStage: PipelineStage): boolean {
    const current = this.resolveCurrentStage(request);
    if (!current) return false; // All done, no stage actions left
    return current.stage === targetStage;
  }

  /**
   * Check if a stage has been completed for a request.
   */
  isStageComplete(request: CarRequest, stage: PipelineStage): boolean {
    const def = PIPELINE_STAGES.find((s) => s.stage === stage);
    if (!def) return false;
    const value = request[def.completionField];
    return value !== null && value !== undefined;
  }

  /**
   * Validate that the user's role is authorized for the given stage.
   */
  isRoleAuthorizedForStage(role: string, stage: PipelineStage): boolean {
    const allowedRoles = STAGE_ROLE_MAP[stage] ?? [];
    return allowedRoles.includes(role.toLowerCase());
  }

  /**
   * Get the previous stage in the applicable sequence for a request.
   */
  getPreviousStage(request: CarRequest, stage: PipelineStage): StageDefinition | null {
    const stages = this.getApplicableStages(request);
    const idx = stages.findIndex((s) => s.stage === stage);
    if (idx <= 0) return null;
    return stages[idx - 1];
  }

  /**
   * Get the next stage in the applicable sequence for a request.
   */
  getNextStage(request: CarRequest): StageDefinition | null {
    const current = this.resolveCurrentStage(request);
    if (!current) return null;
    const stages = this.getApplicableStages(request);
    const idx = stages.findIndex((s) => s.stage === current.stage);
    if (idx < 0 || idx >= stages.length - 1) return null;
    return stages[idx + 1];
  }

  /**
   * Compute the pipeline progress as a dictionary of stage → status.
   */
  getStageProgress(
    request: CarRequest,
  ): Partial<Record<PipelineStage, { status: 'completed' | 'current' | 'pending'; name: string }>> {
    const stages = this.getApplicableStages(request);
    const current = this.resolveCurrentStage(request);
    const result: Partial<Record<PipelineStage, { status: 'completed' | 'current' | 'pending'; name: string }>> = {};

    for (const stage of stages) {
      const isComplete = this.isStageComplete(request, stage.stage);
      const isCurrent = current?.stage === stage.stage;

      if (isComplete) {
        result[stage.stage] = { status: 'completed', name: stage.name };
      } else if (isCurrent) {
        result[stage.stage] = { status: 'current', name: stage.name };
      } else {
        result[stage.stage] = { status: 'pending', name: stage.name };
      }
    }

    return result;
  }
}
