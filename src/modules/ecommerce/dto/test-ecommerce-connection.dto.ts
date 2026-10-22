import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class TestEcommerceConnectionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'connectionId must be a numeric string' })
  connectionId!: string;
}
