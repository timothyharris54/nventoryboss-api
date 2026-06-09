import { IsNotEmpty, IsString } from 'class-validator';
import { ReservationSourceType } from '@prisma/client';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  locationCode?: string;

  @IsString()
  @IsNotEmpty()
  quantity?: string;

  @IsString()
  @IsNotEmpty()
  sourceType?: ReservationSourceType;

  @IsString()
  @IsNotEmpty()
  sourceId?: string;

  @IsString()
  @IsNotEmpty()
  notes?: string;
}
