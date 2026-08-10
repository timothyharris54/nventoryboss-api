import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import {
  SubscriptionAccountsAdminController,
  SubscriptionAdminController,
} from './subscription-admin.controller';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [AuthModule],
  controllers: [
    SubscriptionController,
    SubscriptionPlansController,
    SubscriptionAccountsAdminController,
    SubscriptionAdminController,
  ],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
