import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  nextPurchaseOrderNumber?: number;
}
