import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EcommerceAuthType, EcommerceProvider } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { EcommerceConnectionsService } from './ecommerce-connections.service';

describe('EcommerceConnectionsService', () => {
  let service: EcommerceConnectionsService;
  const prismaMock = {
    ecommerceConnection: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EcommerceConnectionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<EcommerceConnectionsService>(
      EcommerceConnectionsService,
    );
  });

  it('creates an account-scoped connection and redacts credentials', async () => {
    prismaMock.ecommerceConnection.create.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      provider: EcommerceProvider.woocommerce,
      channelKey: 'woocommerce-main-store',
      displayName: 'Main Store',
      storeUrl: 'https://store.example.com',
      externalStoreId: null,
      authType: EcommerceAuthType.api_key,
      credentials: {
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      },
      settings: null,
      defaultLocationCode: 'MAIN',
      currencyCode: 'USD',
      isActive: true,
      lastSyncedAt: null,
      lastConnectionTestedAt: null,
      lastConnectionStatus: null,
      lastConnectionError: null,
      createdAt: new Date('2026-06-13T12:00:00.000Z'),
      updatedAt: new Date('2026-06-13T12:00:00.000Z'),
    });

    const result = await service.create({
      accountId: 1n,
      dto: {
        provider: EcommerceProvider.woocommerce,
        displayName: ' Main Store ',
        storeUrl: ' https://store.example.com ',
        credentials: {
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
        currencyCode: 'usd',
      },
    });

    expect(prismaMock.ecommerceConnection.create).toHaveBeenCalledWith({
      data: {
        accountId: 1n,
        provider: EcommerceProvider.woocommerce,
        channelKey: 'woocommerce-main-store',
        displayName: 'Main Store',
        storeUrl: 'https://store.example.com',
        externalStoreId: undefined,
        authType: EcommerceAuthType.api_key,
        credentials: {
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
        settings: undefined,
        defaultLocationCode: 'MAIN',
        currencyCode: 'USD',
        isActive: true,
      },
    });
    expect(result).toMatchObject({
      id: 10n,
      hasCredentials: true,
      credentialKeys: ['consumerKey', 'consumerSecret'],
    });
    expect(result).not.toHaveProperty('credentials');
  });

  it('lists connections without returning credential values', async () => {
    prismaMock.ecommerceConnection.findMany.mockResolvedValue([
      {
        id: 10n,
        accountId: 1n,
        credentials: {
          token: 'secret',
        },
      },
    ]);

    await expect(service.findAll(1n)).resolves.toEqual([
      {
        id: 10n,
        accountId: 1n,
        hasCredentials: true,
        credentialKeys: ['token'],
      },
    ]);
    expect(prismaMock.ecommerceConnection.findMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
      },
      orderBy: {
        id: 'asc',
      },
    });
  });

  it('updates only connections in the account', async () => {
    prismaMock.ecommerceConnection.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      credentials: null,
    });
    prismaMock.ecommerceConnection.update.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      displayName: 'Updated Store',
      credentials: null,
    });

    const result = await service.update({
      accountId: 1n,
      id: 10n,
      dto: {
        displayName: ' Updated Store ',
        isActive: false,
      },
    });

    expect(prismaMock.ecommerceConnection.findFirst).toHaveBeenCalledWith({
      where: {
        id: 10n,
        accountId: 1n,
      },
    });
    expect(prismaMock.ecommerceConnection.update).toHaveBeenCalledWith({
      where: {
        id: 10n,
        accountId: 1n,
      },
      data: expect.objectContaining({
        displayName: 'Updated Store',
        isActive: false,
      }),
    });
    expect(result).toMatchObject({
      id: 10n,
      displayName: 'Updated Store',
      hasCredentials: false,
      credentialKeys: [],
    });
  });

  it('throws when updating a connection outside the account', async () => {
    prismaMock.ecommerceConnection.findFirst.mockResolvedValue(null);

    await expect(
      service.update({
        accountId: 1n,
        id: 10n,
        dto: {
          displayName: 'Updated Store',
        },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.ecommerceConnection.update).not.toHaveBeenCalled();
  });
});
