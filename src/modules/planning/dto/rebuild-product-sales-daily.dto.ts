import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class RebuildSalesDailyDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
