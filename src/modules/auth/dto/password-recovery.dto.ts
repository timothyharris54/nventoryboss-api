import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
