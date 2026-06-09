import { IsString } from 'class-validator';

export class SubmitPurchaseOrderDto {
  @IsString()
  locationCode: string;
}
