import { PartialType } from '@nestjs/swagger';
import { CreateVendorPlatformDto } from './create-vendor-platform.dto';

export class UpdateVendorPlatformDto extends PartialType(
  CreateVendorPlatformDto,
) {}
