import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { SettingsService } from './settings.service.js';
import { AddOptionDto } from './dto/add-option.dto.js';
import { EditOptionDto } from './dto/edit-option.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @Roles('super_admin')
  @ApiOperation({ summary: 'List all settings with options' })
  async findAll() {
    return this.settingsService.getAll();
  }

  @Get(':key')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get setting by key with options' })
  async findByKey(@Param('key') key: string) {
    return this.settingsService.getByKey(key);
  }

  @Post(':key/options')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Add an option to a setting' })
  async addOption(
    @Param('key') key: string,
    @Body() dto: AddOptionDto,
  ) {
    return this.settingsService.addOption(key, dto);
  }

  @Patch(':key/options/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Edit an option' })
  async editOption(
    @Param('key') key: string,
    @Param('id') id: string,
    @Body() dto: EditOptionDto,
  ) {
    return this.settingsService.editOption(key, +id, dto);
  }

  @Patch(':key/options/:id/deprecate')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Deprecate an option (soft delete)' })
  async deprecateOption(
    @Param('key') key: string,
    @Param('id') id: string,
  ) {
    return this.settingsService.deprecateOption(key, +id);
  }

  @Patch(':key/options/:id/restore')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Restore a deprecated option' })
  async restoreOption(
    @Param('key') key: string,
    @Param('id') id: string,
  ) {
    return this.settingsService.restoreOption(key, +id);
  }

  @Patch(':key/options/reorder')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reorder options by sort_order' })
  async reorderOptions(
    @Param('key') key: string,
    @Body() dto: ReorderDto,
  ) {
    return this.settingsService.reorderOptions(key, dto);
  }
}
