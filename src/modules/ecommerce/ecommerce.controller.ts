import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateEcommerceConnectionDto } from './dto/create-ecommerce-connection.dto';
import { UpdateEcommerceConnectionDto } from './dto/update-ecommerce-connection.dto';
import { EcommerceConnectionsService } from './ecommerce-connections.service';
import { WoocommerceService } from './woocommerce/woocommerce.service';

@Controller('ecommerce')
@ApiTags('Ecommerce')
export class EcommerceController {
  constructor(
    private readonly ecommerceConnectionsService: EcommerceConnectionsService,
    private readonly woocommerceService: WoocommerceService,
  ) {}

  @Get('connections')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getConnections(@CurrentIdentity() identity: RequestIdentity) {
    return this.ecommerceConnectionsService.findAll(BigInt(identity.accountId));
  }

  @Post('connections')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createConnection(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: CreateEcommerceConnectionDto,
  ) {
    return this.ecommerceConnectionsService.create({
      accountId: BigInt(identity.accountId),
      dto,
    });
  }

  @Get('connections/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getConnection(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.ecommerceConnectionsService.findOne({
      accountId: BigInt(identity.accountId),
      id: BigInt(id),
    });
  }

  @Patch('connections/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateConnection(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() dto: UpdateEcommerceConnectionDto,
  ) {
    return this.ecommerceConnectionsService.update({
      accountId: BigInt(identity.accountId),
      id: BigInt(id),
      dto,
    });
  }

  @Post('woocommerce/test-connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  testWoocommerceConnection(@CurrentIdentity() identity: RequestIdentity) {
    return this.woocommerceService.testConnection(BigInt(identity.accountId));
  }

  @Post('woocommerce/sync-products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  syncWoocommerceProducts(@CurrentIdentity() identity: RequestIdentity) {
    return this.woocommerceService.syncProducts(BigInt(identity.accountId));
  }

  @Post('woocommerce/sync-orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  syncWoocommerceOrders(@CurrentIdentity() identity: RequestIdentity) {
    return this.woocommerceService.syncOrders(BigInt(identity.accountId));
  }

  @Post('woocommerce/post-order-inventory-impact')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  postWoocommerceOrderInventoryImpact(
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.woocommerceService.postOrderInventoryImpact(
      BigInt(identity.accountId),
    );
  }
}
