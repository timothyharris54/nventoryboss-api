import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { WoocommerceService } from './woocommerce.service';

describe('WoocommerceService', () => {
  let service: WoocommerceService;
  let prismaMock: {
    product: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    order: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let inventoryServiceMock: {
    postExternalChannelSaleEvent: jest.Mock;
  };
  let txMock: {
    order: {
      upsert: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    orderLine: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
  };
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    prismaMock = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    inventoryServiceMock = {
      postExternalChannelSaleEvent: jest.fn(),
    };
    txMock = {
      order: {
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      orderLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation((callback) => callback(txMock));

    process.env = {
      ...originalEnv,
      WOOCOMMERCE_DEMO_STORE_URL: 'https://dexsdoghouse.com',
      WOOCOMMERCE_DEMO_CONSUMER_KEY: 'ck_test',
      WOOCOMMERCE_DEMO_CONSUMER_SECRET: 'cs_test',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WoocommerceService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: InventoryService,
          useValue: inventoryServiceMock,
        },
      ],
    }).compile();

    service = module.get<WoocommerceService>(WoocommerceService);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns configured WooCommerce connection metadata without credentials', () => {
    expect(service.getConnections()).toEqual([
      {
        id: 'woocommerce-demo',
        provider: 'woocommerce',
        label: 'WooCommerce demo store',
        storeUrl: 'https://dexsdoghouse.com',
        configured: true,
      },
    ]);
  });

  it('tests the products endpoint with per_page=1 and basic auth', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue([{ id: 10, sku: 'DOG-1', name: 'Toy' }]),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(service.testConnection()).resolves.toEqual({
      connectionId: 'woocommerce-demo',
      ok: true,
      productsEndpoint: 'https://dexsdoghouse.com/wp-json/wc/v3/products',
      sampleCount: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://dexsdoghouse.com/wp-json/wc/v3/products?per_page=1',
      {
        headers: {
          Authorization: `Basic ${Buffer.from('ck_test:cs_test').toString(
            'base64',
          )}`,
          Accept: 'application/json',
        },
      },
    );
  });

  it('requires credentials before calling WooCommerce', async () => {
    process.env.WOOCOMMERCE_DEMO_CONSUMER_SECRET = '';

    await expect(service.testConnection()).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('upserts WooCommerce products by account and SKU', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 10, sku: 'DOG-1', name: 'Toy', status: 'publish' },
          { id: 11, sku: '', name: 'No SKU', status: 'publish' },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    prismaMock.product.findUnique.mockResolvedValue(null);
    prismaMock.product.upsert.mockResolvedValue({
      id: 123n,
      sku: 'DOG-1',
      name: 'Toy',
    });

    await expect(service.syncProducts(1n)).resolves.toEqual({
      connectionId: 'woocommerce-demo',
      fetched: 2,
      synced: 1,
      skipped: 1,
      items: [
        {
          woocommerceId: 10,
          productId: '123',
          sku: 'DOG-1',
          name: 'Toy',
          action: 'created',
        },
      ],
      skippedItems: [{ woocommerceId: 11, reason: 'missing_sku' }],
    });

    expect(prismaMock.product.upsert).toHaveBeenCalledWith({
      where: {
        accountId_sku: {
          accountId: 1n,
          sku: 'DOG-1',
        },
      },
      create: {
        accountId: 1n,
        sku: 'DOG-1',
        name: 'Toy',
        status: ProductStatus.active,
      },
      update: {
        name: 'Toy',
        status: ProductStatus.active,
      },
    });
  });

  it('syncs WooCommerce orders into local orders and lines', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 9001,
            status: 'processing',
            date_created_gmt: '2026-05-30T14:15:00',
            currency: 'USD',
            total: '42.50',
            billing: {
              first_name: 'Dex',
              last_name: 'Doghouse',
              email: 'dex@example.com',
            },
            line_items: [
              {
                id: 10001,
                sku: 'DOG-1',
                name: 'Dog Toy',
                quantity: 2,
                price: '10.00',
                total: '20.00',
              },
              {
                id: 10002,
                sku: '',
                name: 'Unmapped Item',
                quantity: 1,
                total: '22.50',
              },
            ],
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([{ id: 123n, sku: 'DOG-1' }]);
    txMock.order.upsert.mockResolvedValue({ id: 7001n });
    txMock.order.findUniqueOrThrow.mockResolvedValue({
      id: 7001n,
      status: OrderStatus.processing,
      orderLines: [{ productId: 123n }, { productId: null }],
    });

    await expect(service.syncOrders(1n)).resolves.toEqual({
      connectionId: 'woocommerce-demo',
      fetched: 1,
      synced: 1,
      skipped: 0,
      items: [
        {
          woocommerceId: 9001,
          orderId: '7001',
          status: OrderStatus.processing,
          lineCount: 2,
          unmappedLineCount: 1,
          action: 'created',
        },
      ],
      skippedItems: [],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://dexsdoghouse.com/wp-json/wc/v3/orders?per_page=100&page=1',
      {
        headers: {
          Authorization: `Basic ${Buffer.from('ck_test:cs_test').toString(
            'base64',
          )}`,
          Accept: 'application/json',
        },
      },
    );
    expect(prismaMock.product.findMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        sku: {
          in: ['DOG-1'],
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });
    expect(txMock.order.upsert).toHaveBeenCalledWith({
      where: {
        accountId_channel_channelOrderId: {
          accountId: 1n,
          channel: 'woocommerce',
          channelOrderId: '9001',
        },
      },
      create: {
        accountId: 1n,
        channel: 'woocommerce',
        channelOrderId: '9001',
        status: OrderStatus.processing,
        orderedAt: new Date('2026-05-30T14:15:00Z'),
        customerName: 'Dex Doghouse',
        customerEmail: 'dex@example.com',
        currencyCode: 'USD',
        orderTotal: expect.anything(),
      },
      update: {
        status: OrderStatus.processing,
        orderedAt: new Date('2026-05-30T14:15:00Z'),
        customerName: 'Dex Doghouse',
        customerEmail: 'dex@example.com',
        currencyCode: 'USD',
        orderTotal: expect.anything(),
      },
    });
    expect(txMock.orderLine.deleteMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        orderId: 7001n,
      },
    });
    expect(txMock.orderLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountId: 1n,
          orderId: 7001n,
          productId: 123n,
          channelLineId: '10001',
          sku: 'DOG-1',
          productName: 'Dog Toy',
        }),
        expect.objectContaining({
          accountId: 1n,
          orderId: 7001n,
          productId: null,
          channelLineId: '10002',
          sku: null,
          productName: 'Unmapped Item',
        }),
      ],
    });
  });

  it('skips WooCommerce orders without a usable order date', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 9002, line_items: [] }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(service.syncOrders(1n)).resolves.toEqual({
      connectionId: 'woocommerce-demo',
      fetched: 1,
      synced: 0,
      skipped: 1,
      items: [],
      skippedItems: [{ woocommerceId: 9002, reason: 'missing_order_date' }],
    });

    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('posts inventory impact only for eligible mapped WooCommerce order lines', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 7001n,
        channelOrderId: '9001',
        orderLines: [
          {
            id: 8001n,
            productId: 123n,
            channelLineId: '10001',
          },
          {
            id: 8002n,
            productId: null,
            channelLineId: '10002',
          },
          {
            id: 8003n,
            productId: 124n,
            channelLineId: null,
          },
        ],
      },
    ]);
    inventoryServiceMock.postExternalChannelSaleEvent.mockResolvedValue({
      action: 'created',
      ledgerEntry: { id: 90001n },
    });

    await expect(service.postOrderInventoryImpact(1n)).resolves.toEqual({
      connectionId: 'woocommerce-demo',
      eligibleOrders: 1,
      posted: 1,
      alreadyPosted: 0,
      skipped: 2,
      items: [
        {
          orderId: '7001',
          channelOrderId: '9001',
          orderLineId: '8001',
          channelLineId: '10001',
          productId: '123',
          action: 'created',
        },
      ],
      skippedItems: [
        {
          orderId: '7001',
          channelOrderId: '9001',
          orderLineId: '8002',
          reason: 'missing_product_mapping',
        },
        {
          orderId: '7001',
          channelOrderId: '9001',
          orderLineId: '8003',
          reason: 'missing_channel_line_id',
        },
      ],
    });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        channel: 'woocommerce',
        status: {
          in: [OrderStatus.processing, OrderStatus.paid, OrderStatus.completed],
        },
      },
      include: {
        orderLines: true,
      },
      orderBy: {
        orderedAt: 'asc',
      },
    });
    expect(
      inventoryServiceMock.postExternalChannelSaleEvent,
    ).toHaveBeenCalledTimes(1);
    expect(
      inventoryServiceMock.postExternalChannelSaleEvent,
    ).toHaveBeenCalledWith({
      accountId: 1n,
      orderLineId: 8001n,
      locationCode: 'MAIN',
    });
  });
});
