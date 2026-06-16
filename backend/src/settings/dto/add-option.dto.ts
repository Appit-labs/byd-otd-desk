import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddOptionDto {
  @ApiProperty({ example: 'Red' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'red' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Optional JSON metadata (e.g. working_days, allows_accessories, outcome_behavior, parentId)',
    example: { working_days: 7, allows_accessories: true },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Parent option id for hierarchical options (e.g. Brand→Model→Variant)',
  })
  @IsOptional()
  @IsInt()
  parentId?: number;
}
