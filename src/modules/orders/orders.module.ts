import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesOrdersController } from './sales-orders.controller';

@Module({
  imports: [InventoryModule],
  providers: [OrdersService],
  controllers: [OrdersController, SalesOrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
