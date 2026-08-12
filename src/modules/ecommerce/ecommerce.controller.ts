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
import { UserRoleCode } from '@prisma/client';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { CreateEcommerceConnectionDto } from './dto/create-ecommerce-connection.dto';
import { UpdateEcommerceConnectionDto } from './dto/update-ecommerce-connection.dto';
import { EcommerceConnectionsService } from './ecommerce-connections.service';
import { WoocommerceService } from './woocommerce/woocommerce.service';
import { ShopifyService } from './shopify/shopify.service';

@Controller('ecommerce')
@ApiTags('Ecommerce')
export class EcommerceController {
  constructor(
    private readonly ecommerceConnectionsService: EcommerceConnectionsService,
    private readonly woocommerceService: WoocommerceService,
    private readonly shopifyService: ShopifyService,
  ) {}

  @Get('connections')
  @ApiBearerAuth()
  @Roles(UserRoleCode.system_admin, UserRoleCode.account_admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  getConnections(@CurrentIdentity() identity: RequestIdentity) {
    return this.ecommerceConnectionsService.findAll(BigInt(identity.accountId));
  }

  @Post('connections')
  @ApiBearerAuth()
  @Roles(UserRoleCode.system_admin, UserRoleCode.account_admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRoleCode.system_admin, UserRoleCode.account_admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRoleCode.system_admin, UserRoleCode.account_admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post('shopify/test-connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  testShopifyConnection(@CurrentIdentity() identity: RequestIdentity) {
    return this.shopifyService.testConnection(BigInt(identity.accountId));
  }

  @Post('shopify/sync-products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  syncShopifyProducts(@CurrentIdentity() identity: RequestIdentity) {
    return this.shopifyService.syncProducts(BigInt(identity.accountId));
  }

  @Post('shopify/sync-orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  syncShopifyOrders(@CurrentIdentity() identity: RequestIdentity) {
    return this.shopifyService.syncOrders(BigInt(identity.accountId));
  }

  @Post('shopify/post-order-inventory-impact')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  postShopifyOrderInventoryImpact(
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.shopifyService.postOrderInventoryImpact(
      BigInt(identity.accountId),
    );
  }
}
