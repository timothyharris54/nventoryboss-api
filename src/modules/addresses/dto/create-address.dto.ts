import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'business', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  addressTypeCode!: string;

  @ApiPropertyOptional({ example: 'Head Office', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string | null;

  @ApiPropertyOptional({ example: 'Receiving Department', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientName?: string | null;

  @ApiPropertyOptional({ example: 'Acme Corporation', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string | null;

  @ApiProperty({ example: '123 Main Street', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Suite 400', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;

  @ApiProperty({ example: 'Atlanta', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'GA', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string | null;

  @ApiPropertyOptional({ example: '30303', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiProperty({ example: 'US', minLength: 2, maxLength: 2 })
  @IsString()
  @Length(2, 2)
  countryCode!: string;
}
