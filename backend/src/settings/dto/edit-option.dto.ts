import { IsString, IsOptional, IsInt, Min } from 'class-validator';
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
}
