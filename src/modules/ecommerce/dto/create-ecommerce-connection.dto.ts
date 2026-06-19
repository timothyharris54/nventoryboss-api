import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EcommerceAuthType, EcommerceProvider } from '@prisma/client';

export class CreateEcommerceConnectionDto {
  @IsEnum(EcommerceProvider)
  provider!: EcommerceProvider;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  channelKey?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  storeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalStoreId?: string;

  @IsOptional()
  @IsEnum(EcommerceAuthType)
  authType?: EcommerceAuthType;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultLocationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
