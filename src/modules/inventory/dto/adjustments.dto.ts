import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdjustmentsDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  locationCode!: string;

  @IsString()
  @IsNotEmpty()
  quantityDelta!: string;

  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  occurredAt!: string;
}
