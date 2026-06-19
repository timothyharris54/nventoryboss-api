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
import { CreateVendorPlatformDto } from 'src/modules/vendors/dto/create-vendor-platform.dto';
import { UpdateVendorDto } from 'src/modules/vendors/dto/update-vendor.dto';
import { UpdateVendorPlatformDto } from 'src/modules/vendors/dto/update-vendor-platform.dto';
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

  @Get('platforms')
  findAllPlatforms(@CurrentIdentity() identity: RequestIdentity) {
    return this.vendorsService.findAllPlatforms(BigInt(identity.accountId));
  }

  @Post('platforms')
  createPlatform(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: CreateVendorPlatformDto,
  ) {
    return this.vendorsService.createPlatform({
      accountId: BigInt(identity.accountId),
      dto,
    });
  }

  @Patch('platforms/:id')
  updatePlatform(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() dto: UpdateVendorPlatformDto,
  ) {
    return this.vendorsService.updatePlatform({
      accountId: BigInt(identity.accountId),
      id: BigInt(id),
      dto,
    });
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
