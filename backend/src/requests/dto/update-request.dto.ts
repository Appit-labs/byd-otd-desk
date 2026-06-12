import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRequestDto } from './create-request.dto.js';

export class UpdateRequestDto extends PartialType(
  OmitType(CreateRequestDto, ['createdAt'] as const),
) {}
