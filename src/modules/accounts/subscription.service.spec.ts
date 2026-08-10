import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prismaMock: {
    account: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    accountSubscription: { findUnique: jest.Mock; upsert: jest.Mock };
    featureDefinition: { findMany: jest.Mock; findUnique: jest.Mock };
    accountFeatureOverride: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
    subscriptionPlan: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  const features = [
    {
      id: 1,
      code: 'shopify_sync',
      displayName: 'Shopify synchronization',
      description: 'Sync Shopify data.',
      isActive: true,
    },
    {
      id: 2,
      code: 'locations',
      displayName: 'Locations',
      description: null,
      isActive: true,
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      account: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      accountSubscription: { findUnique: jest.fn(), upsert: jest.fn() },
      featureDefinition: {
        findMany: jest.fn().mockResolvedValue(features),
        findUnique: jest.fn(),
      },
      accountFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      subscriptionPlan: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(SubscriptionService);
  });

  function mockSubscription(
    status: SubscriptionStatus = SubscriptionStatus.active,
  ) {
    prismaMock.accountSubscription.findUnique.mockResolvedValue({
      id: 10n,
      status,
      billingProvider: 'manual',
      trialEndsAt: null,
      currentPeriodStartsAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      planPrice: null,
      plan: {
        code: 'starter',
        displayName: 'Starter',
        description: null,
        entitlements: [
          {
            enabled: true,
            limit: null,
            feature: features[0],
          },
          {
            enabled: true,
            limit: 1,
            feature: features[1],
          },
        ],
      },
    });
  }

  it('returns effective plan entitlements for an active subscription', async () => {
    mockSubscription();

    const result = await service.getAccountSubscription(1n);

    expect(result.entitled).toBe(true);
    expect(result.subscription?.id).toBe('10');
    expect(result.subscription?.status).toBe(SubscriptionStatus.active);
    expect(result.subscription?.plan.code).toBe('starter');
    expect(result.entitlements[0]).toMatchObject({
      code: 'shopify_sync',
      enabled: true,
      source: 'plan',
    });
    expect(result.entitlements[1]).toMatchObject({
      code: 'locations',
      enabled: true,
      limit: 1,
    });
  });

  it('applies a non-expired account override over the plan value', async () => {
    mockSubscription();
    prismaMock.accountFeatureOverride.findMany.mockResolvedValue([
      {
        enabled: false,
        limit: null,
        expiresAt: null,
        feature: features[0],
      },
    ]);

    await expect(service.getEntitlement(1n, 'shopify_sync')).resolves.toEqual(
      expect.objectContaining({
        enabled: false,
        source: 'override',
      }),
    );
  });

  it('disables entitlements when the subscription is not active', async () => {
    mockSubscription(SubscriptionStatus.cancelled);

    await expect(
      service.requireFeature(1n, 'shopify_sync'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces numeric plan limits', async () => {
    mockSubscription();

    await expect(
      service.requireWithinLimit(1n, 'locations', 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unknown feature codes', async () => {
    mockSubscription();

    await expect(service.getEntitlement(1n, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists accounts with their subscription assignments', async () => {
    const createdAt = new Date('2026-08-01T12:00:00Z');
    prismaMock.account.findMany.mockResolvedValue([
      {
        id: 2n,
        name: 'Example Company',
        createdAt,
        subscription: {
          status: SubscriptionStatus.active,
          billingProvider: 'manual',
          trialEndsAt: null,
          currentPeriodEndsAt: null,
          plan: { code: 'growth', displayName: 'Growth' },
        },
        _count: { featureOverrides: 1 },
      },
    ]);
    prismaMock.account.count.mockResolvedValue(1);

    await expect(
      service.listAccountsForSubscriptionAdmin({ search: ' Example ' }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: '2',
          name: 'Example Company',
          featureOverrideCount: 1,
        }),
      ],
      total: 1,
      skip: 0,
      take: 50,
    });
    expect(prismaMock.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: 'Example', mode: 'insensitive' } },
      }),
    );
  });

  it('creates a manual subscription assignment and clears billing linkage', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 2n });
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
      id: 3,
      isActive: true,
    });
    prismaMock.accountSubscription.findUnique.mockResolvedValue(null);
    jest
      .spyOn(service, 'getAccountSubscriptionForAdmin')
      .mockResolvedValue({ ok: true } as never);

    await expect(
      service.upsertAccountSubscription(2n, {
        planCode: 'growth',
        status: SubscriptionStatus.active,
      }),
    ).resolves.toEqual({ ok: true });

    expect(prismaMock.accountSubscription.upsert).toHaveBeenCalledWith({
      where: { accountId: 2n },
      update: {
        planId: 3,
        status: SubscriptionStatus.active,
        billingProvider: 'manual',
        planPriceId: null,
        externalCustomerId: null,
        externalSubscriptionId: null,
        trialEndsAt: null,
        currentPeriodStartsAt: null,
        currentPeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
      create: {
        accountId: 2n,
        planId: 3,
        status: SubscriptionStatus.active,
        billingProvider: 'manual',
        planPriceId: null,
        externalCustomerId: null,
        externalSubscriptionId: null,
        trialEndsAt: null,
        currentPeriodStartsAt: null,
        currentPeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });
  });

  it('rejects assignment to an inactive plan', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 2n });
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
      id: 3,
      isActive: false,
    });
    prismaMock.accountSubscription.findUnique.mockResolvedValue(null);

    await expect(
      service.upsertAccountSubscription(2n, {
        planCode: 'retired',
        status: SubscriptionStatus.active,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.accountSubscription.upsert).not.toHaveBeenCalled();
  });

  it('upserts an account feature override by feature code', async () => {
    const timestamp = new Date('2026-08-01T12:00:00Z');
    prismaMock.account.findUnique.mockResolvedValue({ id: 2n });
    prismaMock.featureDefinition.findUnique.mockResolvedValue({
      id: 7,
      code: 'locations',
      displayName: 'Locations',
      isActive: true,
    });
    prismaMock.accountFeatureOverride.upsert.mockResolvedValue({
      id: 9n,
      enabled: true,
      limit: 10,
      reason: 'Temporary increase',
      expiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      feature: { code: 'locations', displayName: 'Locations' },
    });

    await expect(
      service.upsertAccountFeatureOverride(2n, 'locations', {
        enabled: true,
        limit: 10,
        reason: 'Temporary increase',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: '9',
        enabled: true,
        limit: 10,
        reason: 'Temporary increase',
      }),
    );
  });

  it('deletes an existing account feature override', async () => {
    prismaMock.featureDefinition.findUnique.mockResolvedValue({ id: 7 });
    prismaMock.accountFeatureOverride.findUnique.mockResolvedValue({ id: 9n });

    await service.deleteAccountFeatureOverride(2n, 'locations');

    expect(prismaMock.accountFeatureOverride.delete).toHaveBeenCalledWith({
      where: { id: 9n },
    });
  });
});
