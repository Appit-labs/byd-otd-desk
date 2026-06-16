import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Setting } from '../database/entities/setting.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';
import { AddOptionDto } from './dto/add-option.dto.js';
import { EditOptionDto } from './dto/edit-option.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

/** Values for request_type options that must never be deleted */
const PROTECTED_REQUEST_TYPES = ['pdi', 're_pdi', 'no_pdi'];

/**
 * Auto-generate a URL-safe slug from a human-readable label.
 * Example: "Window Tinting" → "window_tinting"
 */
function labelToSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
    @InjectRepository(SettingOption)
    private optionsRepository: Repository<SettingOption>,
    private dataSource: DataSource,
  ) {}

  async getAll(): Promise<Setting[]> {
    return this.settingsRepository.find({
      relations: { options: true },
      order: { options: { sortOrder: 'ASC' } },
    });
  }

  async getByKey(key: string, parentId?: number): Promise<Setting> {
    const setting = await this.settingsRepository.findOne({
      where: { key },
      relations: { options: true },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    // Filter by parentId if provided
    let options = setting.options;
    if (parentId !== undefined) {
      options = options.filter((opt) => opt.parentId === parentId);
    }
    // Sort options by sortOrder
    setting.options = options.sort((a, b) => a.sortOrder - b.sortOrder);
    return setting;
  }

  async getOptionsByKey(key: string, parentId?: number): Promise<SettingOption[]> {
    const setting = await this.settingsRepository.findOne({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    const where: any = { settingId: setting.id, isActive: true };
    if (parentId !== undefined) {
      where.parentId = parentId;
    }
    return this.optionsRepository.find({
      where,
      order: { sortOrder: 'ASC' },
    });
  }

  async addOption(settingKey: string, dto: AddOptionDto): Promise<SettingOption> {
    const setting = await this.getByKey(settingKey);

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOption = await this.optionsRepository.findOne({
        where: { settingId: setting.id },
        order: { sortOrder: 'DESC' },
      });
      sortOrder = maxOption ? maxOption.sortOrder + 1 : 0;
    }

    const value = (dto.value?.trim() || labelToSlug(dto.label)) || labelToSlug(dto.label);

    const option = this.optionsRepository.create({
      settingId: setting.id,
      label: dto.label,
      value,
      sortOrder,
      parentId: dto.parentId ?? null,
      metadata: dto.metadata ?? null,
    });

    return this.optionsRepository.save(option);
  }

  async editOption(
    settingKey: string,
    optionId: number,
    dto: EditOptionDto,
  ): Promise<SettingOption> {
    const setting = await this.getByKey(settingKey);

    const option = await this.optionsRepository.findOne({
      where: { id: optionId, settingId: setting.id },
    });
    if (!option) {
      throw new NotFoundException(
        `Option with id ${optionId} not found for setting "${settingKey}"`,
      );
    }

    if (dto.label !== undefined) {
      option.label = dto.label;
      // If label changes and value is empty/missing, regenerate slug from new label
      if (!dto.value?.trim()) {
        option.value = labelToSlug(dto.label);
      }
    }
    if (dto.value !== undefined && dto.value.trim()) {
      option.value = dto.value;
    }
    if (dto.sortOrder !== undefined) {
      option.sortOrder = dto.sortOrder;
    }
    if (dto.parentId !== undefined) {
      option.parentId = dto.parentId;
    }
    if (dto.metadata !== undefined) {
      // Merge with existing metadata rather than full replace, so callers
      // can patch a single metadata key without destroying other keys.
      option.metadata = {
        ...(option.metadata ?? {}),
        ...dto.metadata,
      };
    }

    return this.optionsRepository.save(option);
  }

  async deprecateOption(
    settingKey: string,
    optionId: number,
  ): Promise<SettingOption> {
    const option = await this.findOptionOrThrow(settingKey, optionId);

    // Prevent deletion of protected request types
    if (settingKey === 'request_type' && PROTECTED_REQUEST_TYPES.includes(option.value)) {
      throw new ForbiddenException(
        `The request type "${option.label}" (${option.value}) cannot be deleted.`,
      );
    }

    option.isActive = false;
    return this.optionsRepository.save(option);
  }

  async restoreOption(
    settingKey: string,
    optionId: number,
  ): Promise<SettingOption> {
    const option = await this.findOptionOrThrow(settingKey, optionId);
    option.isActive = true;
    return this.optionsRepository.save(option);
  }

  async reorderOptions(
    settingKey: string,
    dto: ReorderDto,
  ): Promise<void> {
    await this.getByKey(settingKey);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const order of dto.orders) {
        const option = await queryRunner.manager.findOne(SettingOption, {
          where: { id: order.id },
        });
        if (!option) {
          throw new NotFoundException(
            `Option with id ${order.id} not found`,
          );
        }
        option.sortOrder = order.sortOrder;
        await queryRunner.manager.save(option);
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async findOptionOrThrow(
    settingKey: string,
    optionId: number,
  ): Promise<SettingOption> {
    const setting = await this.getByKey(settingKey);

    const option = await this.optionsRepository.findOne({
      where: { id: optionId, settingId: setting.id },
    });
    if (!option) {
      throw new NotFoundException(
        `Option with id ${optionId} not found for setting "${settingKey}"`,
      );
    }

    return option;
  }
}
