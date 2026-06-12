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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.usersService.findAll(skip ?? 0, take ?? 20);
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(+id);
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Deactivate a user' })
  async deactivate(@Param('id') id: string) {
    await this.usersService.deactivate(+id);
    return { message: 'User deactivated' };
  }

  @Patch(':id/status')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Toggle user active status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { is_active: boolean },
  ) {
    return this.usersService.updateStatus(+id, body.is_active);
  }
}
