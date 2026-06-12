import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
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
}
