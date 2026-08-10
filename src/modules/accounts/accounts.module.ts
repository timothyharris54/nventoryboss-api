import { Module } from '@nestjs/common';
import { EcommerceModule } from 'src/modules/ecommerce/ecommerce.module';
import { PlanningModule } from 'src/modules/planning/planning.module';
import { AccountsController } from './accounts.controller';
import { SalesRefreshService } from './sales-refresh.service';
import { SubscriptionModule } from './subscription.module';
import { AccountsService } from './accounts.service';
import { AccountsAdminController } from './accounts.admin.controller';
import { AuthModule } from 'src/modules/auth/auth.module';
import { EmailModule } from 'src/modules/email/email.module';

@Module({
  imports: [
    AuthModule,
    EcommerceModule,
    EmailModule,
    PlanningModule,
    SubscriptionModule,
  ],
  controllers: [AccountsController, AccountsAdminController],
  providers: [SalesRefreshService, AccountsService],
})
export class AccountsModule {}
