import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryPlanningService } from './services/inventory-planning.service';
import { InventoryBalanceService } from './services/inventory-balance.service';

@Module({
  imports: [PrismaModule],
  providers: [
    InventoryService,
    InventoryPlanningService,
    InventoryBalanceService,
  ],
  controllers: [InventoryController],
  exports: [
    InventoryService,
    InventoryPlanningService,
    InventoryBalanceService,
  ],
})
export class InventoryModule {}
