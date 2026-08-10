import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EcommerceProvider, ProductStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { ShopifyService } from './shopify.service';
import { SubscriptionService } from 'src/modules/accounts/subscription.service';

describe('ShopifyService', () => {
  let service: ShopifyService;
  let prisma: any;
  let tx: any;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    tx = {
      order: { upsert: jest.fn(), findUniqueOrThrow: jest.fn() },
      orderLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      ecommerceConnection: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      ecommerceProductMapping: { upsert: jest.fn().mockResolvedValue({}) },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      order: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const module = await Test.createTestingModule({
      providers: [
        ShopifyService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: InventoryService,
          useValue: { postExternalChannelSaleEvent: jest.fn() },
        },
        {
          provide: SubscriptionService,
          useValue: { requireFeature: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();
    service = module.get(ShopifyService);
    prisma.ecommerceConnection.findFirst.mockResolvedValue({
      id: 12n,
      storeUrl: 'https://teh-variety-store.myshopify.com/',
      credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
      settings: { apiVersion: '2026-07' },
      defaultLocationCode: 'MAIN',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockTokenAndGraphql(data: unknown) {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'shopify-token',
          expires_in: 86400,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ data }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('returns configured Shopify connection metadata without credentials', async () => {
    prisma.ecommerceConnection.findMany.mockResolvedValue([
      {
        id: 12n,
        displayName: 'Teh Variety Store',
        storeUrl: 'https://teh-variety-store.myshopify.com/',
        credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
        channelKey: 'shopify-main',
      },
      {
        id: 13n,
        displayName: 'Incomplete Store',
        storeUrl: null,
        credentials: {},
        channelKey: 'shopify-secondary',
      },
    ]);

    await expect(service.getConnections(1n)).resolves.toEqual([
      {
        id: '12',
        provider: 'shopify',
        label: 'Teh Variety Store',
        storeUrl: 'https://teh-variety-store.myshopify.com/',
        configured: true,
        channelKey: 'shopify-main',
      },
      {
        id: '13',
        provider: 'shopify',
        label: 'Incomplete Store',
        storeUrl: null,
        configured: false,
        channelKey: 'shopify-secondary',
      },
    ]);
    expect(prisma.ecommerceConnection.findMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        provider: EcommerceProvider.shopify,
        isActive: true,
      },
      orderBy: { id: 'asc' },
    });
  });

  it('exchanges client credentials and tests the store connection', async () => {
    const fetchMock = mockTokenAndGraphql({
      shop: {
        id: 'gid://shopify/Shop/1',
        name: 'Teh Variety Store',
        myshopifyDomain: 'teh-variety-store.myshopify.com',
      },
    });

    await expect(service.testConnection(1n)).resolves.toEqual({
      connectionId: '12',
      ok: true,
      shop: {
        id: 'gid://shopify/Shop/1',
        name: 'Teh Variety Store',
        myshopifyDomain: 'teh-variety-store.myshopify.com',
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://teh-variety-store.myshopify.com/admin/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        body: 'grant_type=client_credentials&client_id=client-id&client_secret=client-secret',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://teh-variety-store.myshopify.com/admin/api/2026-07/graphql.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Shopify-Access-Token': 'shopify-token',
        }),
      }),
    );
    expect(prisma.ecommerceConnection.update).toHaveBeenCalledWith({
      where: { id: 12n },
      data: expect.objectContaining({
        lastConnectionStatus: 'connected',
        lastConnectionError: null,
      }),
    });
  });

  it('syncs product variants by SKU and records Shopify mappings', async () => {
    mockTokenAndGraphql({
      products: {
        nodes: [
          {
            id: 'gid://shopify/Product/10',
            title: 'T-Shirt',
            status: 'ACTIVE',
            featuredMedia: {
              preview: { image: { url: 'https://cdn.test/shirt.jpg' } },
            },
            variants: {
              nodes: [
                {
                  id: 'gid://shopify/ProductVariant/20',
                  title: 'Blue',
                  sku: 'TS-BLUE',
                },
                {
                  id: 'gid://shopify/ProductVariant/21',
                  title: 'Red',
                  sku: '',
                },
              ],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.upsert.mockResolvedValue({ id: 101n });

    await expect(service.syncProducts(1n)).resolves.toEqual(
      expect.objectContaining({
        connectionId: '12',
        fetched: 1,
        synced: 1,
        skipped: 1,
      }),
    );
    expect(prisma.product.upsert).toHaveBeenCalledWith({
      where: { accountId_sku: { accountId: 1n, sku: 'TS-BLUE' } },
      create: {
        accountId: 1n,
        sku: 'TS-BLUE',
        name: 'T-Shirt - Blue',
        status: ProductStatus.active,
        isVariant: true,
        imageUrl: 'https://cdn.test/shirt.jpg',
      },
      update: {
        name: 'T-Shirt - Blue',
        status: ProductStatus.active,
        isVariant: true,
        imageUrl: 'https://cdn.test/shirt.jpg',
      },
    });
    expect(prisma.ecommerceProductMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: EcommerceProvider.shopify,
          externalProductId: 'gid://shopify/Product/10',
          externalVariantId: 'gid://shopify/ProductVariant/20',
        }),
      }),
    );
  });

  it('syncs Shopify orders and maps lines to local products by SKU', async () => {
    mockTokenAndGraphql({
      orders: {
        nodes: [
          {
            id: 'gid://shopify/Order/30',
            legacyResourceId: '30',
            name: '#1001',
            createdAt: '2026-07-31T12:00:00Z',
            displayFinancialStatus: 'PAID',
            displayFulfillmentStatus: 'UNFULFILLED',
            currencyCode: 'USD',
            totalPriceSet: { shopMoney: { amount: '19.98' } },
            customer: { displayName: 'Test Buyer', email: 'buyer@example.com' },
            lineItems: {
              nodes: [
                {
                  id: 'gid://shopify/LineItem/40',
                  name: 'T-Shirt',
                  quantity: 2,
                  sku: 'TS-BLUE',
                  originalUnitPriceSet: { shopMoney: { amount: '9.99' } },
                },
              ],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });
    prisma.order.findUnique.mockResolvedValue(null);
    prisma.product.findMany.mockResolvedValue([{ id: 101n, sku: 'TS-BLUE' }]);
    tx.order.upsert.mockResolvedValue({ id: 201n });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      id: 201n,
      status: 'paid',
      orderLines: [{ productId: 101n }],
    });

    await expect(service.syncOrders(1n)).resolves.toEqual(
      expect.objectContaining({
        connectionId: '12',
        fetched: 1,
        synced: 1,
        skipped: 0,
      }),
    );
    expect(tx.order.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          channel: 'shopify',
          channelOrderId: '30',
          status: 'paid',
        }),
      }),
    );
    expect(tx.orderLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId: 101n,
          channelLineId: 'gid://shopify/LineItem/40',
          sku: 'TS-BLUE',
        }),
      ],
    });
  });

  it('rejects non-Shopify store domains before sending credentials', async () => {
    prisma.ecommerceConnection.findFirst.mockResolvedValue({
      id: 12n,
      storeUrl: 'https://example.com',
      credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
      settings: {},
      defaultLocationCode: 'MAIN',
    });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(service.testConnection(1n)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
