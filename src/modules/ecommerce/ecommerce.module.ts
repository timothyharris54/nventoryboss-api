import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { EcommerceConnectionsService } from './ecommerce-connections.service';
import { EcommerceController } from './ecommerce.controller';
import { WoocommerceService } from './woocommerce/woocommerce.service';

@Module({
  imports: [InventoryModule],
  controllers: [EcommerceController],
  providers: [EcommerceConnectionsService, WoocommerceService],
  exports: [EcommerceConnectionsService, WoocommerceService],
})
export class EcommerceModule {}
