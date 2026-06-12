import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service.js';
import { StageTransitionsService } from './stage-transitions.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { QueryRequestsDto } from './dto/query-requests.dto.js';
import {
  TransitionRequestDto,
  BulkTransitionRequestDto,
} from './dto/transition-request.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'requests', version: '1' })
export class RequestsController {
  constructor(
    private requestsService: RequestsService,
    private stageTransitionsService: StageTransitionsService,
  ) {}

  @Get()
  @Roles('super_admin', 'admin', 'department_user')
  @ApiOperation({ summary: 'List all car requests (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['not_started', 'pending', 'on_hold', 'completed'] })
  @ApiQuery({ name: 'departmentId', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'requestTypeId', required: false, type: Number })
  @ApiQuery({ name: 'sellerId', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of car requests' })
  async findAll(@Query() query: QueryRequestsDto) {
    return this.requestsService.findAll(query);
  }

  @Get(':id')
  @Roles('super_admin', 'admin', 'department_user')
  @ApiOperation({ summary: 'Get car request by ID with transitions' })
  @ApiResponse({ status: 200, description: 'Car request found' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOne(@Param('id') id: string) {
    return this.requestsService.findById(+id);
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new car request' })
  @ApiResponse({ status: 201, description: 'Car request created' })
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.requestsService.create(createRequestDto, userId);
  }

  @Patch(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update a car request' })
  @ApiResponse({ status: 200, description: 'Car request updated' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async update(
    @Param('id') id: string,
    @Body() updateRequestDto: UpdateRequestDto,
  ) {
    return this.requestsService.update(+id, updateRequestDto);
  }

  @Delete(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete a car request' })
  @ApiResponse({ status: 200, description: 'Car request deleted' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async delete(@Param('id') id: string) {
    await this.requestsService.delete(+id);
    return { message: 'Request deleted successfully' };
  }

  @Patch(':id/hold')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Toggle hold status on a car request' })
  @ApiResponse({ status: 200, description: 'Hold status toggled' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async toggleHold(@Param('id') id: string) {
    return this.requestsService.toggleHold(+id);
  }

  @Post(':id/transition')
  @Roles('super_admin', 'department_user')
  @ApiOperation({ summary: 'Transition a request stage (start or complete)' })
  @ApiResponse({ status: 201, description: 'Transition created' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Request or department not found' })
  @ApiResponse({ status: 409, description: 'Conflict - transition already exists' })
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionRequestDto,
    @CurrentUser() user: { id: number; role: string; departmentId: number | null },
  ) {
    return this.stageTransitionsService.transition(
      +id,
      dto.departmentId,
      dto.action,
      user,
    );
  }

  @Post('bulk-transition')
  @Roles('super_admin', 'department_user')
  @ApiOperation({ summary: 'Bulk transition multiple requests' })
  @ApiResponse({ status: 201, description: 'Bulk transition processed' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async bulkTransition(
    @Body() dto: BulkTransitionRequestDto,
    @CurrentUser() user: { id: number; role: string; departmentId: number | null },
  ) {
    return this.stageTransitionsService.bulkTransition(
      dto.requestIds,
      dto.departmentId,
      dto.action,
      user,
    );
  }
}
