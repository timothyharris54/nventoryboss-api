import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prismaMock: {
    accountSubscription: { findUnique: jest.Mock };
    featureDefinition: { findMany: jest.Mock };
    accountFeatureOverride: { findMany: jest.Mock };
    subscriptionPlan: { findMany: jest.Mock };
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
      accountSubscription: { findUnique: jest.fn() },
      featureDefinition: { findMany: jest.fn().mockResolvedValue(features) },
      accountFeatureOverride: { findMany: jest.fn().mockResolvedValue([]) },
      subscriptionPlan: { findMany: jest.fn() },
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

    await expect(service.getAccountSubscription(1n)).resolves.toEqual(
      expect.objectContaining({
        entitled: true,
        subscription: expect.objectContaining({
          id: '10',
          status: SubscriptionStatus.active,
          plan: expect.objectContaining({ code: 'starter' }),
        }),
        entitlements: [
          expect.objectContaining({
            code: 'shopify_sync',
            enabled: true,
            source: 'plan',
          }),
          expect.objectContaining({
            code: 'locations',
            enabled: true,
            limit: 1,
          }),
        ],
      }),
    );
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
});
