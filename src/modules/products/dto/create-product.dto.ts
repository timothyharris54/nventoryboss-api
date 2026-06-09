import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name!: string;
}
