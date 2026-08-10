import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ListSubscriptionAccountsQueryDto } from './dto/list-subscription-accounts-query.dto';
import { UpsertAccountFeatureOverrideDto } from './dto/upsert-account-feature-override.dto';
import { UpsertAccountSubscriptionDto } from './dto/upsert-account-subscription.dto';

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

  async listAccountsForSubscriptionAdmin(
    query: ListSubscriptionAccountsQueryDto,
  ) {
    const search = query.search?.trim();
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};
    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        select: {
          id: true,
          name: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              billingProvider: true,
              trialEndsAt: true,
              currentPeriodEndsAt: true,
              plan: { select: { code: true, displayName: true } },
            },
          },
          _count: { select: { featureOverrides: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: query.skip ?? 0,
        take: query.take ?? 50,
      }),
      this.prisma.account.count({ where }),
    ]);

    return {
      items: accounts.map((account) => ({
        id: account.id.toString(),
        name: account.name,
        createdAt: account.createdAt,
        subscription: account.subscription,
        featureOverrideCount: account._count.featureOverrides,
      })),
      total,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    };
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

  async getAccountSubscriptionForAdmin(accountId: bigint) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, name: true },
    });
    if (!account) {
      throw new NotFoundException(`Account '${accountId}' was not found`);
    }

    const [summary, overrides] = await Promise.all([
      this.getAccountSubscription(accountId),
      this.prisma.accountFeatureOverride.findMany({
        where: { accountId },
        include: { feature: true },
        orderBy: { feature: { code: 'asc' } },
      }),
    ]);

    return {
      account: { id: account.id.toString(), name: account.name },
      ...summary,
      featureOverrides: overrides.map((override) =>
        this.toFeatureOverrideResponse(override),
      ),
    };
  }

  async upsertAccountSubscription(
    accountId: bigint,
    dto: UpsertAccountSubscriptionDto,
  ) {
    const [account, plan, existing] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true },
      }),
      this.prisma.subscriptionPlan.findUnique({
        where: { code: dto.planCode },
        select: { id: true, isActive: true },
      }),
      this.prisma.accountSubscription.findUnique({
        where: { accountId },
        select: { cancelledAt: true },
      }),
    ]);

    if (!account) {
      throw new NotFoundException(`Account '${accountId}' was not found`);
    }
    if (!plan || !plan.isActive) {
      throw new NotFoundException(
        `Active subscription plan '${dto.planCode}' was not found`,
      );
    }

    const cancelledAt =
      dto.status === SubscriptionStatus.cancelled
        ? dto.cancelledAt
          ? new Date(dto.cancelledAt)
          : (existing?.cancelledAt ?? new Date())
        : null;
    const data = {
      planId: plan.id,
      planPriceId: null,
      status: dto.status,
      billingProvider: 'manual',
      externalCustomerId: null,
      externalSubscriptionId: null,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
      currentPeriodStartsAt: dto.currentPeriodStartsAt
        ? new Date(dto.currentPeriodStartsAt)
        : null,
      currentPeriodEndsAt: dto.currentPeriodEndsAt
        ? new Date(dto.currentPeriodEndsAt)
        : null,
      cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
      cancelledAt,
    };

    await this.prisma.accountSubscription.upsert({
      where: { accountId },
      update: data,
      create: { accountId, ...data },
    });

    return this.getAccountSubscriptionForAdmin(accountId);
  }

  async upsertAccountFeatureOverride(
    accountId: bigint,
    featureCode: string,
    dto: UpsertAccountFeatureOverrideDto,
  ) {
    const [account, feature] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true },
      }),
      this.prisma.featureDefinition.findUnique({
        where: { code: featureCode },
        select: { id: true, code: true, displayName: true, isActive: true },
      }),
    ]);

    if (!account) {
      throw new NotFoundException(`Account '${accountId}' was not found`);
    }
    if (!feature || !feature.isActive) {
      throw new NotFoundException(
        `Active feature '${featureCode}' was not found`,
      );
    }

    const data = {
      enabled: dto.enabled,
      limit: dto.limit ?? null,
      reason: dto.reason ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };
    const override = await this.prisma.accountFeatureOverride.upsert({
      where: { accountId_featureId: { accountId, featureId: feature.id } },
      update: data,
      create: { accountId, featureId: feature.id, ...data },
      include: { feature: true },
    });

    return this.toFeatureOverrideResponse(override);
  }

  async deleteAccountFeatureOverride(accountId: bigint, featureCode: string) {
    const feature = await this.prisma.featureDefinition.findUnique({
      where: { code: featureCode },
      select: { id: true },
    });
    if (!feature) {
      throw new NotFoundException(`Feature '${featureCode}' was not found`);
    }

    const override = await this.prisma.accountFeatureOverride.findUnique({
      where: { accountId_featureId: { accountId, featureId: feature.id } },
      select: { id: true },
    });
    if (!override) {
      throw new NotFoundException(
        `Feature override '${featureCode}' was not found for account '${accountId}'`,
      );
    }

    await this.prisma.accountFeatureOverride.delete({
      where: { id: override.id },
    });
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

  private toFeatureOverrideResponse(override: {
    id: bigint;
    enabled: boolean;
    limit: number | null;
    reason: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    feature: { code: string; displayName: string };
  }) {
    return {
      id: override.id.toString(),
      feature: {
        code: override.feature.code,
        displayName: override.feature.displayName,
      },
      enabled: override.enabled,
      limit: override.limit,
      reason: override.reason,
      expiresAt: override.expiresAt,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    };
  }
}
