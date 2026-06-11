import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'requests', version: '1' })
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List all car requests' })
  async findAll() {
    return this.requestsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get car request by ID' })
  async findOne(@Param('id') id: string) {
    return this.requestsService.findById(+id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new car request' })
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.requestsService.create(createRequestDto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a car request' })
  async update(
    @Param('id') id: string,
    @Body() updateRequestDto: UpdateRequestDto,
  ) {
    return this.requestsService.update(+id, updateRequestDto);
  }
}
