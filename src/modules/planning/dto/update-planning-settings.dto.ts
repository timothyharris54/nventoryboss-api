import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePlanningSettingsDto {
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultSafetyStock?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultTargetDaysOfCover?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultLeadTimeDays?: number;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultMinReorderQty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultLocationCode?: string;
}
