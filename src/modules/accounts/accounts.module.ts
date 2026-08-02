import { Module } from '@nestjs/common';
import { EcommerceModule } from 'src/modules/ecommerce/ecommerce.module';
import { PlanningModule } from 'src/modules/planning/planning.module';
import { AccountsController } from './accounts.controller';
import { SalesRefreshService } from './sales-refresh.service';
import { SubscriptionModule } from './subscription.module';

@Module({
  imports: [EcommerceModule, PlanningModule, SubscriptionModule],
  controllers: [AccountsController],
  providers: [SalesRefreshService],
})
export class AccountsModule {}
