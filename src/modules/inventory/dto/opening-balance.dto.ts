import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OpeningBalanceDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  locationCode!: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
