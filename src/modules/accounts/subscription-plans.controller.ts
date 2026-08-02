import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';

@Controller('subscription-plans')
@UseGuards(JwtAuthGuard)
@ApiTags('Subscriptions')
@ApiBearerAuth()
export class SubscriptionPlansController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  listPlans() {
    return this.subscriptionService.listPlans();
  }
}
