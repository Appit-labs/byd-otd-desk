import { IsString, IsOptional, IsInt, IsObject, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditOptionDto {
  @ApiPropertyOptional({ example: 'Crimson Red' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 'crimson_red' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Optional JSON metadata merge (e.g. working_days, allows_accessories, outcome_behavior)',
    example: { working_days: 5 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Parent option id for hierarchical options',
  })
  @IsOptional()
  @IsInt()
  parentId?: number;
}
