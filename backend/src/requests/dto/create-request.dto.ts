import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsReasonableDate } from '../../common/validators/is-reasonable-date.validator.js';

export class CreateRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  requestTypeId: number;

  @ApiProperty({ example: 'ABC1234' })
  @IsString()
  @IsNotEmpty()
  carNumber: string;

  @ApiPropertyOptional({ example: 'BDY-001' })
  @IsOptional()
  @IsString()
  bodyNumber?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  carColorId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  carSpecId: number;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @ApiProperty({ example: '+628123456789' })
  @IsString()
  @IsNotEmpty()
  clientTel: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  paymentMethodId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  sellerId: number;

  @ApiPropertyOptional({ example: 'Client prefers morning delivery' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @ApiProperty({ example: '2026-06-12T10:00:00.000Z' })
  @IsDateString()
  @IsReasonableDate()
  @IsNotEmpty()
  createdAt: string;
}
