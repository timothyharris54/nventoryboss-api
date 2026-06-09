import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { EcommerceController } from './ecommerce.controller';
import { WoocommerceService } from './woocommerce/woocommerce.service';

@Module({
  imports: [InventoryModule],
  controllers: [EcommerceController],
  providers: [WoocommerceService],
  exports: [WoocommerceService],
})
export class EcommerceModule {}
