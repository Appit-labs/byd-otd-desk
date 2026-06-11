import { IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'superadmin' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 1, description: 'Login context department' })
  @IsOptional()
  @IsInt()
  departmentId?: number;
}
