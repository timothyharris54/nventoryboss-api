import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesDailyService } from './services/sales-daily.service';
import { PlanningSettingsService } from './services/planning-settings.service';
import { ReplenishmentEngineService } from './services/replenishment-engine.service';
import { SalesDailyController } from './controllers/sales-daily/sales-daily.controller';
import { ReplenishmentController } from './controllers/replenishment.controller';
import { RecommendationsController } from './controllers/recommendations.controller';
import { RecommendationsService } from './services/recommendations.service';
import { PlanningSettingsController } from './controllers/planning-settings.controller';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [
    SalesDailyController,
    ReplenishmentController,
    RecommendationsController,
    PlanningSettingsController,
  ],
  providers: [
    PlanningSettingsService,
    SalesDailyService,
    ReplenishmentEngineService,
    RecommendationsService,
  ],
  exports: [
    PlanningSettingsService,
    SalesDailyService,
    ReplenishmentEngineService,
    RecommendationsService,
  ],
})
export class PlanningModule {}
