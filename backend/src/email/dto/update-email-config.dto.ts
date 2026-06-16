import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEmail,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmailConfigDto {
  @ApiPropertyOptional({ example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional({ example: 'user@gmail.com' })
  @IsOptional()
  @IsString()
  smtpUsername?: string;

  @ApiPropertyOptional({ example: 'app-password' })
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiPropertyOptional({ example: 'noreply@talentino.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  fromAddress?: string;

  @ApiPropertyOptional({ example: 'OTD BYD Tracker' })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
