import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  accountId!: string;

  @ApiProperty({ example: 'business' })
  addressTypeCode!: string;

  @ApiPropertyOptional({ example: 'Head Office', nullable: true })
  label!: string | null;

  @ApiPropertyOptional({ example: 'Receiving Department', nullable: true })
  recipientName!: string | null;

  @ApiPropertyOptional({ example: 'Acme Corporation', nullable: true })
  companyName!: string | null;

  @ApiProperty({ example: '123 Main Street' })
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Suite 400', nullable: true })
  addressLine2!: string | null;

  @ApiProperty({ example: 'Atlanta' })
  city!: string;

  @ApiPropertyOptional({ example: 'GA', nullable: true })
  region!: string | null;

  @ApiPropertyOptional({ example: '30303', nullable: true })
  postalCode!: string | null;

  @ApiProperty({ example: 'US' })
  countryCode!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
