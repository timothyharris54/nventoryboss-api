import { Module } from '@nestjs/common';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  controllers: [SubscriptionController, SubscriptionPlansController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
