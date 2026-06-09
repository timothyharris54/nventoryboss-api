import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SalesRefreshDto {
  @IsOptional()
  @IsBoolean()
  runReplenishment?: boolean;

  @IsOptional()
  @IsBoolean()
  dryRunReplenishment?: boolean;

  @IsOptional()
  @IsString()
  locationCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lookbackDays?: number;
}
