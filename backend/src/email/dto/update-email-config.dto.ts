import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEmail,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmailConfigDto {
  @ApiPropertyOptional({ example: 'resend', enum: ['resend', 'smtp'] })
  @IsOptional()
  @IsString()
  @IsIn(['resend', 'smtp'])
  provider?: string;

  @ApiPropertyOptional({ example: 're_xxxx' })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiPropertyOptional({ example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  smtp_host?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtp_port?: number;

  @ApiPropertyOptional({ example: 'user@gmail.com' })
  @IsOptional()
  @IsString()
  smtp_username?: string;

  @ApiPropertyOptional({ example: 'app-password' })
  @IsOptional()
  @IsString()
  smtp_password?: string;

  @ApiPropertyOptional({ example: 'noreply@talentino.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  from_address?: string;

  @ApiPropertyOptional({ example: 'OTD BYD Tracker' })
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
