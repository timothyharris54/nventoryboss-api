import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;
}
