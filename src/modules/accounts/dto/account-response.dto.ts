import { ApiProperty } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 'Acme Corporation' })
  name: string;

  @ApiProperty({ example: 1000, description: 'The next invoice number for the account' })
  nextPurchaseOrderNumber: number;
}
