import { PartialType } from '@nestjs/swagger';
import { CreateVendorProductDto } from './create-vendor-product.dto';

export class UpdateVendorProductDto extends PartialType(
  CreateVendorProductDto,
) {}
