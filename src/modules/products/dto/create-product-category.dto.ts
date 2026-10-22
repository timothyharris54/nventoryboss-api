import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  safetyStock?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetDaysOfCover?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number | null;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  minReorderQty?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  locationCode?: string | null;
}
