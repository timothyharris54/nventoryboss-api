import { UserRoleCode } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRoleCode, { each: true })
  roleCodes?: UserRoleCode[];
}
