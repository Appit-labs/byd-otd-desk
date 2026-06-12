import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Setting } from '../database/entities/setting.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';
import { AddOptionDto } from './dto/add-option.dto.js';
import { EditOptionDto } from './dto/edit-option.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

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

  async getByKey(key: string): Promise<Setting> {
    const setting = await this.settingsRepository.findOne({
      where: { key },
      relations: { options: true },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    // Sort options by sortOrder
    setting.options = setting.options.sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    return setting;
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

    const option = this.optionsRepository.create({
      settingId: setting.id,
      label: dto.label,
      value: dto.value,
      sortOrder,
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
    }
    if (dto.value !== undefined) {
      option.value = dto.value;
    }
    if (dto.sortOrder !== undefined) {
      option.sortOrder = dto.sortOrder;
    }

    return this.optionsRepository.save(option);
  }

  async deprecateOption(
    settingKey: string,
    optionId: number,
  ): Promise<SettingOption> {
    const option = await this.findOptionOrThrow(settingKey, optionId);
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
