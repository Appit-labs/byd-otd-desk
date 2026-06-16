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
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { RequestsService } from './requests.service.js';
import { StageTransitionsService } from './stage-transitions.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { QueryRequestsDto } from './dto/query-requests.dto.js';
import {
  TransitionRequestDto,
  BulkTransitionRequestDto,
} from './dto/transition-request.dto.js';
import {
  FinalInspectionDto,
  ConfirmDeliveryDto,
  MechanicalCheckCompleteDto,
  PdiCompleteDto,
  AccessoriesCompleteDto,
  ReactivateDto,
} from './dto/stage-action.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { ActionUser } from './requests.service.js';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'requests', version: '1' })
export class RequestsController {
  constructor(
    private requestsService: RequestsService,
    private stageTransitionsService: StageTransitionsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  //  Query / CRUD
  // ─────────────────────────────────────────────────────────────

  @Get()
  @Roles('super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery', 'viewer')
  @ApiOperation({ summary: 'List all car requests (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'cancelled', 'archived_manual', 'archived_qc'] })
  @ApiQuery({ name: 'departmentId', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'requestTypeId', required: false, type: Number })
  @ApiQuery({ name: 'sellerId', required: false, type: Number })
  @ApiQuery({ name: 'timeliness', required: false, enum: ['all', 'on_time', 'delayed'] })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of car requests' })
  async findAll(@Query() query: QueryRequestsDto) {
    return this.requestsService.findAll(query);
  }

  @Get(':id')
  @Roles('super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery', 'viewer')
  @ApiOperation({ summary: 'Get car request by ID with transitions' })
  @ApiResponse({ status: 200, description: 'Car request found' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOne(@Param('id') id: string) {
    return this.requestsService.findById(+id);
  }

  @Post()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a new car request' })
  @ApiResponse({ status: 201, description: 'Car request created' })
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.requestsService.create(createRequestDto, userId);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
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
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete a car request' })
  @ApiResponse({ status: 200, description: 'Car request deleted' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async delete(@Param('id') id: string) {
    await this.requestsService.delete(+id);
    return { message: 'Request deleted successfully' };
  }

  // ─────────────────────────────────────────────────────────────
  //  Legacy transition endpoints (deprecated — prefer stage-specific endpoints)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/transition')
  @Roles('super_admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery')
  @ApiOperation({ summary: '[DEPRECATED] Transition a request stage (start or complete)' })
  @ApiResponse({ status: 201, description: 'Transition created' })
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
  @Roles('super_admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery')
  @ApiOperation({ summary: '[DEPRECATED] Bulk transition multiple requests' })
  @ApiResponse({ status: 201, description: 'Bulk transition processed' })
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

  // ─────────────────────────────────────────────────────────────
  //  Stage 2: Dispatch Vehicle (NVS)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/dispatch-vehicle')
  @Roles('super_admin', 'nvs')
  @ApiOperation({ summary: 'Stage 2: NVS dispatches vehicle to storage' })
  @ApiResponse({ status: 201, description: 'Vehicle dispatched' })
  async dispatchVehicle(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.dispatchVehicle(+id, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 3: Vehicle Received (QC NVS)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/vehicle-received')
  @Roles('super_admin', 'qc_nvs')
  @ApiOperation({ summary: 'Stage 3: QC NVS confirms vehicle received at showroom' })
  @ApiResponse({ status: 201, description: 'Vehicle received confirmed' })
  async vehicleReceived(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.vehicleReceived(+id, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 4: Mechanical Check
  // ─────────────────────────────────────────────────────────────

  @Post(':id/mechanical-check/start')
  @Roles('super_admin', 'mechanical_check')
  @ApiOperation({ summary: 'Stage 4: Start mechanical check' })
  @ApiResponse({ status: 201, description: 'Mechanical check started' })
  async mechanicalCheckStart(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.mechanicalCheckStart(+id, user);
  }

  @Post(':id/mechanical-check/complete')
  @Roles('super_admin', 'mechanical_check')
  @ApiOperation({ summary: 'Stage 4: Complete mechanical check' })
  @ApiResponse({ status: 201, description: 'Mechanical check completed' })
  async mechanicalCheckComplete(
    @Param('id') id: string,
    @Body() dto: MechanicalCheckCompleteDto,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.mechanicalCheckComplete(+id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 5: PDI
  // ─────────────────────────────────────────────────────────────

  @Post(':id/pdi/start')
  @Roles('super_admin', 'pdi')
  @ApiOperation({ summary: 'Stage 5: Start PDI' })
  @ApiResponse({ status: 201, description: 'PDI started' })
  async pdiStart(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.pdiStart(+id, user);
  }

  @Post(':id/pdi/complete')
  @Roles('super_admin', 'pdi')
  @ApiOperation({ summary: 'Stage 5: Complete PDI' })
  @ApiResponse({ status: 201, description: 'PDI completed' })
  async pdiComplete(
    @Param('id') id: string,
    @Body() dto: PdiCompleteDto,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.pdiComplete(+id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 6: Confirm Sent to Accessories (QC NVS)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/confirm-sent-to-accessories')
  @Roles('super_admin', 'qc_nvs')
  @ApiOperation({ summary: 'Stage 6: QC NVS confirms vehicle sent to accessories' })
  @ApiResponse({ status: 201, description: 'Sent to accessories confirmed' })
  async confirmSentToAccessories(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.confirmSentToAccessories(+id, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 7: Accessories
  // ─────────────────────────────────────────────────────────────

  @Post(':id/accessories/start')
  @Roles('super_admin', 'accessories')
  @ApiOperation({ summary: 'Stage 7: Start accessories fitting' })
  @ApiResponse({ status: 201, description: 'Accessories started' })
  async accessoriesStart(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.accessoriesStart(+id, user);
  }

  @Post(':id/accessories/complete')
  @Roles('super_admin', 'accessories')
  @ApiOperation({ summary: 'Stage 7: Complete accessories fitting' })
  @ApiResponse({ status: 201, description: 'Accessories completed' })
  async accessoriesComplete(
    @Param('id') id: string,
    @Body() dto: AccessoriesCompleteDto,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.accessoriesComplete(+id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 8: Final Inspection (QC NVS)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/final-inspection')
  @Roles('super_admin', 'qc_nvs')
  @ApiOperation({ summary: 'Stage 8: QC NVS submits final inspection' })
  @ApiResponse({ status: 201, description: 'Final inspection submitted' })
  async finalInspection(
    @Param('id') id: string,
    @Body() dto: FinalInspectionDto,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.finalInspection(+id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 9: GPS Confirm (Mechanical Check)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/confirm-gps-done')
  @Roles('super_admin', 'mechanical_check')
  @ApiOperation({ summary: 'Stage 9: Mechanical Check confirms GPS done' })
  @ApiResponse({ status: 201, description: 'GPS confirmed' })
  async confirmGpsDone(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.confirmGpsDone(+id, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 10: Register (Registration)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/register')
  @Roles('super_admin', 'registration')
  @ApiOperation({ summary: 'Stage 10: Registration completes vehicle registration' })
  @ApiResponse({ status: 201, description: 'Vehicle registered' })
  async register(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.register(+id, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Stage 11: Confirm Delivery (Delivery)
  // ─────────────────────────────────────────────────────────────

  @Post(':id/confirm-delivery')
  @Roles('super_admin', 'delivery')
  @ApiOperation({ summary: 'Stage 11: Delivery confirms vehicle delivered' })
  @ApiResponse({ status: 201, description: 'Delivery confirmed' })
  async confirmDelivery(
    @Param('id') id: string,
    @Body() dto: ConfirmDeliveryDto,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.confirmDelivery(+id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Cancel / Archive / Reactivate
  // ─────────────────────────────────────────────────────────────

  @Post(':id/cancel')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Cancel a request (Admin/Super Admin only, permanent)' })
  @ApiResponse({ status: 201, description: 'Request cancelled' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.cancel(+id, user);
  }

  @Post(':id/archive')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Manually archive a request (Admin/Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Request archived' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.archive(+id, user);
  }

  @Post(':id/reactivate')
  @Roles('super_admin', 'admin', 'qc_nvs')
  @ApiOperation({ summary: 'Reactivate an archived/cancelled request' })
  @ApiResponse({ status: 201, description: 'Request reactivated' })
  async reactivate(
    @Param('id') id: string,
    @Body() dto: ReactivateDto,
    @CurrentUser() user: ActionUser,
  ) {
    return this.requestsService.reactivate(+id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────
  //  Export
  // ─────────────────────────────────────────────────────────────

  @Get('export')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Export requests as CSV (admin only)' })
  @ApiQuery({
    name: 'period',
    required: true,
    enum: ['week', 'month', 'year', 'all'],
  })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportCsv(
    @Query('period') period: 'week' | 'month' | 'year' | 'all',
    @Res() res: FastifyReply,
  ) {
    const csv = await this.requestsService.exportCsv(period);
    const filename = `byd-otd-requests-${period}-${new Date().toISOString().split('T')[0]}.csv`;

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }

  @Get('export-xlsx')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Export requests as XLSX (admin only)' })
  @ApiQuery({ name: 'period', required: true, enum: ['week', 'month', 'year', 'all'] })
  @ApiResponse({ status: 200, description: 'XLSX file download' })
  async exportXlsx(
    @Query('period') period: 'week' | 'month' | 'year' | 'all',
    @Res() res: FastifyReply,
  ) {
    const xlsx = await this.requestsService.exportXlsx(period);
    const filename = `BYD-OTD-Requests-${period}-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xlsx);
  }
}
