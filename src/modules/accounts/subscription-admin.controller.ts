import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRoleCode } from '@prisma/client';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { ListSubscriptionAccountsQueryDto } from './dto/list-subscription-accounts-query.dto';
import { UpsertAccountFeatureOverrideDto } from './dto/upsert-account-feature-override.dto';
import { UpsertAccountSubscriptionDto } from './dto/upsert-account-subscription.dto';
import { SubscriptionService } from './subscription.service';

@Controller('admin/accounts')
@ApiTags('Subscription Administration')
@ApiBearerAuth()
@Roles(UserRoleCode.system_admin)
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionAccountsAdminController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  listAccounts(@Query() query: ListSubscriptionAccountsQueryDto) {
    return this.subscriptionService.listAccountsForSubscriptionAdmin(query);
  }
}

@Controller('admin/accounts/:accountId/subscription')
@ApiTags('Subscription Administration')
@ApiBearerAuth()
@Roles(UserRoleCode.system_admin)
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionAdminController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  getAccountSubscription(@Param('accountId') accountId: string) {
    return this.subscriptionService.getAccountSubscriptionForAdmin(
      this.parseAccountId(accountId),
    );
  }

  @Put()
  upsertAccountSubscription(
    @Param('accountId') accountId: string,
    @Body() dto: UpsertAccountSubscriptionDto,
  ) {
    return this.subscriptionService.upsertAccountSubscription(
      this.parseAccountId(accountId),
      dto,
    );
  }

  @Put('features/:featureCode')
  upsertFeatureOverride(
    @Param('accountId') accountId: string,
    @Param('featureCode') featureCode: string,
    @Body() dto: UpsertAccountFeatureOverrideDto,
  ) {
    return this.subscriptionService.upsertAccountFeatureOverride(
      this.parseAccountId(accountId),
      featureCode,
      dto,
    );
  }

  @Delete('features/:featureCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeatureOverride(
    @Param('accountId') accountId: string,
    @Param('featureCode') featureCode: string,
  ) {
    await this.subscriptionService.deleteAccountFeatureOverride(
      this.parseAccountId(accountId),
      featureCode,
    );
  }

  private parseAccountId(value: string): bigint {
    if (!/^\d+$/.test(value) || value === '0') {
      throw new BadRequestException('accountId must be a positive integer');
    }

    return BigInt(value);
  }
}
