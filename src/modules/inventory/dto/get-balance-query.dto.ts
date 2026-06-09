import { IsOptional, IsBoolean, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryEventType } from '@prisma/client';

export class GetBalanceQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  locationCode?: string;

  @IsOptional()
  @IsBoolean()
  onlyNonZero?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}
