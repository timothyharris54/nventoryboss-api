import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { WoocommerceService } from './woocommerce/woocommerce.service';

@Controller('ecommerce')
@ApiTags('Ecommerce')
export class EcommerceController {
  constructor(private readonly woocommerceService: WoocommerceService) {}

  @Get('connections')
  getConnections() {
    return this.woocommerceService.getConnections();
  }

  @Post('woocommerce/test-connection')
  testWoocommerceConnection() {
    return this.woocommerceService.testConnection();
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
