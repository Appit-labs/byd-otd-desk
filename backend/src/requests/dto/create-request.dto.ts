import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  requestTypeId: number;

  @ApiProperty({ example: 'KMHXX00XXXX000000' })
  @IsString()
  @IsNotEmpty()
  chassisNumber: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  brandId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  modelId?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Exterior Color ID (FK to setting_options)' })
  @IsOptional()
  @IsInt()
  exteriorColorId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Interior Color ID (FK to setting_options)' })
  @IsOptional()
  @IsInt()
  interiorColorId?: number;

  @ApiPropertyOptional({ example: 'Riyadh Showroom' })
  @IsOptional()
  @IsString()
  vehicleLocation?: string;

  @ApiPropertyOptional({ example: 5, description: 'Showroom ID (FK to setting_options)' })
  @IsOptional()
  @IsInt()
  showroomId?: number;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: '+628123456789' })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  salesConsultantId: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  salesTypeId?: number;

  @ApiPropertyOptional({ example: [1, 2] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  accessories?: number[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasGps?: boolean;

  @ApiPropertyOptional({ example: 'Client prefers morning delivery' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
