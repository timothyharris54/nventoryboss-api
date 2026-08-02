import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { EcommerceConnectionsService } from './ecommerce-connections.service';
import { EcommerceController } from './ecommerce.controller';
import { WoocommerceService } from './woocommerce/woocommerce.service';
import { ShopifyService } from './shopify/shopify.service';
import { SubscriptionModule } from '../accounts/subscription.module';

@Module({
  imports: [InventoryModule, SubscriptionModule],
  controllers: [EcommerceController],
  providers: [EcommerceConnectionsService, WoocommerceService, ShopifyService],
  exports: [EcommerceConnectionsService, WoocommerceService, ShopifyService],
})
export class EcommerceModule {}
