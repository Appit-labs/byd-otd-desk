import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service.js';

@ApiTags('Departments')
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all departments' })
  async findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findById(+id);
  }
}
