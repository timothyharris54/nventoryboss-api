import { Module } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { RecommendationConversionService } from 'src/modules/procurement/services/recommendation-conversion.service';
import { VendorProductSelectorService } from 'src/modules/procurement/services/vendor-product-selector.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  controllers: [ProcurementController],
  providers: [
    ProcurementService,
    RecommendationConversionService,
    VendorProductSelectorService,
  ],
  imports: [InventoryModule],
  exports: [ProcurementService, RecommendationConversionService],
})
export class ProcurementModule {}
