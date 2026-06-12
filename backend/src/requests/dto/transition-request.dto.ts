import { IsEnum, IsInt, IsArray, Min, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransitionRequestDto {
  @ApiProperty({ description: 'Department ID' })
  @IsInt()
  @Min(1)
  departmentId: number;

  @ApiProperty({ enum: ['started', 'completed'] })
  @IsEnum(['started', 'completed'])
  action: 'started' | 'completed';
}

export class BulkTransitionRequestDto {
  @ApiProperty({ description: 'Array of request IDs', type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  requestIds: number[];

  @ApiProperty({ description: 'Department ID' })
  @IsInt()
  @Min(1)
  departmentId: number;

  @ApiProperty({ enum: ['started', 'completed'] })
  @IsEnum(['started', 'completed'])
  action: 'started' | 'completed';
}
