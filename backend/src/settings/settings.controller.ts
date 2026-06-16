import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @Roles('super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery', 'viewer')
  @ApiOperation({ summary: 'List all settings with options' })
  async findAll() {
    return this.settingsService.getAll();
  }

  @Get(':key')
  @Roles('super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery', 'viewer')
  @ApiOperation({ summary: 'Get setting by key with options' })
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  async findByKey(
    @Param('key') key: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.settingsService.getByKey(key, parentId ? +parentId : undefined);
  }

  @Get(':key/options')
  @Roles('super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery', 'viewer')
  @ApiOperation({ summary: 'Get options for a setting key, optionally filtered by parent_id' })
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  async getOptions(
    @Param('key') key: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.settingsService.getOptionsByKey(key, parentId ? +parentId : undefined);
  }

  @Post(':key/options')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Add an option to a setting' })
  async addOption(
    @Param('key') key: string,
    @Body() dto: AddOptionDto,
  ) {
    return this.settingsService.addOption(key, dto);
  }

  @Patch(':key/options/:id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Edit an option' })
  async editOption(
    @Param('key') key: string,
    @Param('id') id: string,
    @Body() dto: EditOptionDto,
  ) {
    return this.settingsService.editOption(key, +id, dto);
  }

  @Patch(':key/options/:id/deprecate')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Deprecate an option (soft delete)' })
  async deprecateOption(
    @Param('key') key: string,
    @Param('id') id: string,
  ) {
    return this.settingsService.deprecateOption(key, +id);
  }

  @Delete(':key/options/:id')
  @Roles('super_admin', 'admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hard-delete an option (deprecate if protected)' })
  async deleteOption(
    @Param('key') key: string,
    @Param('id') id: string,
  ) {
    // Hard-delete by deprecating (soft-delete). The service will reject
    // deletion of protected request types (pdi, re_pdi, no_pdi).
    await this.settingsService.deprecateOption(key, +id);
  }

  @Patch(':key/options/:id/restore')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Restore a deprecated option' })
  async restoreOption(
    @Param('key') key: string,
    @Param('id') id: string,
  ) {
    return this.settingsService.restoreOption(key, +id);
  }

  @Patch(':key/options/reorder')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Reorder options by sort_order' })
  async reorderOptions(
    @Param('key') key: string,
    @Body() dto: ReorderDto,
  ) {
    return this.settingsService.reorderOptions(key, dto);
  }
}
