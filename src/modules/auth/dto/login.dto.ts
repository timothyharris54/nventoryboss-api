import { UserRoleCode } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsEnum(UserRoleCode)
  roleCode?: UserRoleCode;
}

export class SwitchRoleDto {
  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;
}
