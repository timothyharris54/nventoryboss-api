import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SalesRefreshDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  runReplenishment?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  dryRunReplenishment?: boolean;

  @ApiPropertyOptional({ example: 'MAIN' })
  @IsOptional()
  @IsString()
  locationCode?: string;

  @ApiPropertyOptional({ example: 120, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lookbackDays?: number;
}
