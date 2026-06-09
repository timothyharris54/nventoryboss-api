import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumberString,
} from 'class-validator';

export class ConvertRecommendationItemDto {
  @ApiProperty({
    example: '101',
    description: 'Reorder recommendation ID to convert.',
  })
  @IsString()
  @IsNotEmpty()
  @IsNumberString()
  recommendationId!: string;

  @ApiProperty({
    example: '501',
    description: 'Vendor ID to use when converting this recommendation.',
  })
  @IsString()
  @IsOptional()
  @IsNumberString()
  vendorId!: string;

  @ApiProperty({
    example: '12',
    description: 'Quantity to order for this recommendation.',
  })
  @IsString()
  @IsNotEmpty()
  @IsNumberString()
  quantity!: string;
}
