import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

const ENTITLED_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.trialing,
  SubscriptionStatus.active,
]);

export type EffectiveEntitlement = {
  code: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  limit: number | null;
  source: 'plan' | 'override' | 'unassigned';
  overrideExpiresAt: Date | null;
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        prices: {
          where: { isActive: true },
          orderBy: [{ currencyCode: 'asc' }, { billingInterval: 'asc' }],
        },
        entitlements: {
          include: { feature: true },
          orderBy: { feature: { code: 'asc' } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    });

    return plans.map((plan) => ({
      code: plan.code,
      displayName: plan.displayName,
      description: plan.description,
      prices: plan.prices.map((price) => ({
        billingProvider: price.billingProvider,
        billingInterval: price.billingInterval,
        currencyCode: price.currencyCode,
        unitAmountMinor: price.unitAmountMinor,
      })),
      entitlements: plan.entitlements.map((entitlement) => ({
        code: entitlement.feature.code,
        displayName: entitlement.feature.displayName,
        enabled: entitlement.enabled,
        limit: entitlement.limit,
      })),
    }));
  }

  async getAccountSubscription(accountId: bigint) {
    const [subscription, features, overrides] = await Promise.all([
      this.prisma.accountSubscription.findUnique({
        where: { accountId },
        include: {
          plan: {
            include: {
              entitlements: {
                include: { feature: true },
              },
            },
          },
          planPrice: true,
        },
      }),
      this.prisma.featureDefinition.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.accountFeatureOverride.findMany({
        where: {
          accountId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { feature: true },
      }),
    ]);

    const planEntitlements = new Map(
      subscription?.plan.entitlements.map((item) => [
        item.feature.code,
        item,
      ]) ?? [],
    );
    const overrideByCode = new Map(
      overrides.map((item) => [item.feature.code, item]),
    );
    const subscriptionIsEntitled = subscription
      ? ENTITLED_STATUSES.has(subscription.status)
      : false;

    const entitlements: EffectiveEntitlement[] = features.map((feature) => {
      const planEntitlement = planEntitlements.get(feature.code);
      const override = overrideByCode.get(feature.code);

      return {
        code: feature.code,
        displayName: feature.displayName,
        description: feature.description,
        enabled:
          subscriptionIsEntitled &&
          (override?.enabled ?? planEntitlement?.enabled ?? false),
        limit: override?.limit ?? planEntitlement?.limit ?? null,
        source: override ? 'override' : planEntitlement ? 'plan' : 'unassigned',
        overrideExpiresAt: override?.expiresAt ?? null,
      };
    });

    return {
      subscription: subscription
        ? {
            id: subscription.id.toString(),
            status: subscription.status,
            plan: {
              code: subscription.plan.code,
              displayName: subscription.plan.displayName,
              description: subscription.plan.description,
            },
            price: subscription.planPrice
              ? {
                  billingProvider: subscription.planPrice.billingProvider,
                  billingInterval: subscription.planPrice.billingInterval,
                  currencyCode: subscription.planPrice.currencyCode,
                  unitAmountMinor: subscription.planPrice.unitAmountMinor,
                }
              : null,
            billingProvider: subscription.billingProvider,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStartsAt: subscription.currentPeriodStartsAt,
            currentPeriodEndsAt: subscription.currentPeriodEndsAt,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            cancelledAt: subscription.cancelledAt,
          }
        : null,
      entitled: subscriptionIsEntitled,
      entitlements,
    };
  }

  async getEntitlement(
    accountId: bigint,
    featureCode: string,
  ): Promise<EffectiveEntitlement> {
    const summary = await this.getAccountSubscription(accountId);
    const entitlement = summary.entitlements.find(
      (item) => item.code === featureCode,
    );

    if (!entitlement) {
      throw new NotFoundException(`Feature '${featureCode}' is not defined`);
    }

    return entitlement;
  }

  async requireFeature(accountId: bigint, featureCode: string) {
    const entitlement = await this.getEntitlement(accountId, featureCode);
    if (!entitlement.enabled) {
      throw new ForbiddenException(
        `Feature '${featureCode}' is not enabled for this account`,
      );
    }
    return entitlement;
  }

  async requireWithinLimit(
    accountId: bigint,
    featureCode: string,
    currentUsage: number,
    requestedIncrease = 1,
  ) {
    const entitlement = await this.requireFeature(accountId, featureCode);
    if (
      entitlement.limit !== null &&
      currentUsage + requestedIncrease > entitlement.limit
    ) {
      throw new ForbiddenException(
        `Feature '${featureCode}' is limited to ${entitlement.limit}`,
      );
    }
    return entitlement;
  }
}
