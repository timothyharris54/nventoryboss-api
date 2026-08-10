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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { AddressesService } from './addresses.service';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiTags('Addresses')
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @ApiCreatedResponse({ type: AddressResponseDto })
  create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.create(identity.accountId, dto);
  }

  @Get()
  @ApiOkResponse({ type: AddressResponseDto, isArray: true })
  findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.addressesService.findAll(identity.accountId);
  }

  @Get(':id')
  @ApiOkResponse({ type: AddressResponseDto })
  findOne(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.addressesService.findOne(identity.accountId, BigInt(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AddressResponseDto })
  update(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(identity.accountId, BigInt(id), dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: AddressResponseDto })
  remove(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.addressesService.remove(identity.accountId, BigInt(id));
  }
}
