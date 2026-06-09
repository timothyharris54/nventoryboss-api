import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderLineDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @IsOptional()
  @IsString()
  unitPrice?: string;

  @IsOptional()
  @IsString()
  lineTotal?: string;

  @IsOptional()
  @IsString()
  channelLineId?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  channel!: string;

  @IsString()
  @IsNotEmpty()
  channelOrderId!: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsString()
  @IsNotEmpty()
  orderedAt!: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  orderTotal?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines!: CreateOrderLineDto[];
}
