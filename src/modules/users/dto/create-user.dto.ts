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
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'MutuallyExclusivePasswords', async: false })
class MutuallyExclusivePasswords implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as any;
    return !(obj.password && obj.temporaryPassword);
  }

  defaultMessage() {
    return 'Only one of password or temporaryPassword may be provided.';
  }
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Validate(MutuallyExclusivePasswords)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Validate(MutuallyExclusivePasswords)
  temporaryPassword?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRoleCode, { each: true })
  roleCodes!: UserRoleCode[];
}
