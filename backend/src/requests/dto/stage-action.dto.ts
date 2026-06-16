import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** POST /requests/:id/final-inspection */
export class FinalInspectionDto {
  @ApiProperty({ example: 'Good condition' })
  @IsString()
  @IsNotEmpty()
  outcome: string;

  @ApiPropertyOptional({ example: 'Minor scratches noted' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}

/** POST /requests/:id/confirm-delivery */
export class ConfirmDeliveryDto {
  @ApiPropertyOptional({ example: 'Delivered to customer at showroom' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/** POST /requests/:id/mechanical-check/complete */
export class MechanicalCheckCompleteDto {
  @ApiPropertyOptional({ example: 'Brakes replaced' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/** POST /requests/:id/pdi/complete */
export class PdiCompleteDto {
  @ApiPropertyOptional({ example: 'PDI passed, no issues' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/** POST /requests/:id/accessories/complete */
export class AccessoriesCompleteDto {
  @ApiPropertyOptional({ example: 'Spoiler and tint installed' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/** POST /requests/:id/reactivate */
export class ReactivateDto {
  @ApiProperty({ description: 'Whether to reset the promise date to today (otherwise keep original)' })
  @IsBoolean()
  @IsNotEmpty()
  resetDates: boolean;
}
