import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { AddressesService } from './addresses.service';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('admin/accounts/:accountId/addresses')
@ApiTags('Admin Account Addresses')
@ApiBearerAuth()
@Roles(UserRoleCode.system_admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiForbiddenResponse({ description: 'Requires system_admin role' })
export class AddressesAdminController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOkResponse({ type: AddressResponseDto, isArray: true })
  findAll(@Param('accountId') accountId: string) {
    return this.addressesService.findAll(BigInt(accountId));
  }

  @Get(':addressId')
  @ApiOkResponse({ type: AddressResponseDto })
  findOne(
    @Param('accountId') accountId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.addressesService.findOne(BigInt(accountId), BigInt(addressId));
  }

  @Post()
  @ApiCreatedResponse({ type: AddressResponseDto })
  create(@Param('accountId') accountId: string, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(BigInt(accountId), dto);
  }

  @Patch(':addressId')
  @ApiOkResponse({ type: AddressResponseDto })
  update(
    @Param('accountId') accountId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(
      BigInt(accountId),
      BigInt(addressId),
      dto,
    );
  }

  @Delete(':addressId')
  @ApiOkResponse({ type: AddressResponseDto })
  remove(
    @Param('accountId') accountId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.addressesService.remove(BigInt(accountId), BigInt(addressId));
  }
}
