import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { SubscriptionService } from './subscription.service';

@Controller('accounts/current/subscription')
@UseGuards(JwtAuthGuard)
@ApiTags('Subscriptions')
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  getCurrent(@CurrentIdentity() identity: RequestIdentity) {
    return this.subscriptionService.getAccountSubscription(identity.accountId);
  }

  @Get('features/:code')
  getFeature(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('code') code: string,
  ) {
    return this.subscriptionService.getEntitlement(identity.accountId, code);
  }
}
