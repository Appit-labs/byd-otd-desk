import {
  IsString,
  IsInt,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({ example: 'REQ-2024-0001' })
  @IsString()
  requestNumber: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  requestTypeId: number;

  @ApiProperty({ example: 'ABC1234' })
  @IsString()
  carNumber: string;

  @ApiPropertyOptional({ example: 'BDY-001' })
  @IsOptional()
  @IsString()
  bodyNumber?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  carColorId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  carSpecId?: number;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  clientName: string;

  @ApiProperty({ example: '+628123456789' })
  @IsString()
  clientTel: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  paymentMethodId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  sellerId: number;

  @ApiPropertyOptional({ example: 'Client prefers morning delivery' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
