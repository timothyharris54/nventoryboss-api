import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class InitialAdminDto {
  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}

export class CreateAccountDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 1000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  nextPurchaseOrderNumber?: number;

  @ApiProperty({ type: InitialAdminDto })
  @ValidateNested()
  @Type(() => InitialAdminDto)
  initialAdmin: InitialAdminDto;
}
