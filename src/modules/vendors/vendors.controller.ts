import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VendorsService } from 'src/modules/vendors/vendors.service';
import { CreateVendorDto } from 'src/modules/vendors/dto/create-vendor.dto';
import { UpdateVendorDto } from 'src/modules/vendors/dto/update-vendor.dto';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('vendors')
@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post('vendor')
  async create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() createVendorDto: CreateVendorDto,
  ) {
    return this.vendorsService.create({
      accountId: BigInt(identity.accountId),
      createVendorDto,
    });
  }

  @Get('allVendors')
  findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.vendorsService.findAll(BigInt(identity.accountId));
  }

  @Patch('vendor/:id')
  async update(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorsService.update({
      accountId: BigInt(identity.accountId),
      id: BigInt(id),
      updateVendorDto,
    });
  }
}
