import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../database/entities/setting.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
    @InjectRepository(SettingOption)
    private optionsRepository: Repository<SettingOption>,
  ) {}

  async findAll(): Promise<Setting[]> {
    return this.settingsRepository.find({
      relations: ['options'],
    });
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settingsRepository.findOne({
      where: { key },
      relations: ['options'],
    });
  }

  async findOptionsBySettingKey(key: string): Promise<SettingOption[]> {
    const setting = await this.findByKey(key);
    if (!setting) return [];
    return setting.options
      .filter((o) => o.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
