import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  vendorProductId?: string;

  @IsString()
  @IsNotEmpty()
  @IsNumberString()
  orderedQty!: string;

  @IsOptional()
  @IsString()
  @IsNumberString()
  unitCost?: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  poNumber!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  locationCode?: string;

  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}
