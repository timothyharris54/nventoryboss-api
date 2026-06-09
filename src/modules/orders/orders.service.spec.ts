import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

type PrismaOrderCall = {
  where: Prisma.OrderWhereInput;
  orderBy?: unknown;
  take?: number;
  skip?: number;
};

function makeOrderRecord() {
  const createdAt = new Date('2026-06-01T12:00:00.000Z');
  const updatedAt = new Date('2026-06-02T12:00:00.000Z');

  return {
    id: 11n,
    accountId: 7n,
    channel: 'woocommerce',
    channelOrderId: '79377',
    status: 'completed',
    orderedAt: new Date('2026-06-01T10:00:00.000Z'),
    customerName: 'Jane Buyer',
    customerEmail: 'buyer@example.com',
    currencyCode: 'USD',
    orderTotal: new Prisma.Decimal('42.50'),
    createdAt,
    updatedAt,
    orderLines: [
      {
        id: 101n,
        accountId: 7n,
        orderId: 11n,
        productId: 5n,
        channelLineId: 'line-1',
        sku: 'WIDGET-1',
        productName: 'Widget',
        quantity: new Prisma.Decimal('2'),
        unitPrice: new Prisma.Decimal('10.25'),
        lineTotal: new Prisma.Decimal('20.50'),
        createdAt,
        updatedAt,
        product: {
          id: 5n,
          sku: 'WIDGET-1',
          name: 'Widget',
        },
      },
    ],
  };
}

describe('OrdersService', () => {
  let service: OrdersService;

  const prismaMock = {
    order: {
      findMany: jest.fn<Promise<unknown[]>, [PrismaOrderCall]>(),
      count: jest.fn<Promise<number>, [{ where: Prisma.OrderWhereInput }]>(),
      findFirst: jest.fn<Promise<unknown>, [PrismaOrderCall]>(),
    },
  };
  const inventoryServiceMock = {
    postSaleEvent: jest.fn(),
    postSaleReversal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
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

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('searches with account scoping, filters, pagination, and line search', async () => {
    const order = makeOrderRecord();
    prismaMock.order.findMany.mockResolvedValue([order]);
    prismaMock.order.count.mockResolvedValue(1);

    await expect(
      service.search(7n, {
        q: 'widget',
        channel: 'woocommerce',
        status: 'completed',
        customerEmail: 'buyer@example.com',
        orderedFrom: '2026-06-01T00:00:00.000Z',
        orderedTo: '2026-06-08T23:59:59.999Z',
        take: 10,
        skip: 20,
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: '11',
          salesOrderNumber: '79377',
          lines: [
            expect.objectContaining({
              id: '101',
              sku: 'WIDGET-1',
              quantity: '2',
            }),
          ],
          orderLines: [
            expect.objectContaining({
              id: '101',
              sku: 'WIDGET-1',
              quantity: '2',
            }),
          ],
        }),
      ],
      total: 1,
      take: 10,
      skip: 20,
    });

    const findManyArg = prismaMock.order.findMany.mock.calls[0][0];
    expect(findManyArg.where.accountId).toBe(7n);
    expect(findManyArg.where.channel).toBe('woocommerce');
    expect(findManyArg.where.status).toBe('completed');
    expect(findManyArg.where.customerEmail).toEqual({
      contains: 'buyer@example.com',
      mode: 'insensitive',
    });
    expect(findManyArg.where.orderedAt).toEqual({
      gte: new Date('2026-06-01T00:00:00.000Z'),
      lte: new Date('2026-06-08T23:59:59.999Z'),
    });
    expect(findManyArg.where.OR).toHaveLength(4);
    expect(JSON.stringify(findManyArg.where.OR)).toContain('widget');
    expect(JSON.stringify(findManyArg.where.OR)).toContain('orderLines');
    expect(findManyArg.orderBy).toEqual([
      { orderedAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.skip).toBe(20);
    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: findManyArg.where,
    });
  });

  it('finds one order by account and id', async () => {
    const order = makeOrderRecord();
    prismaMock.order.findFirst.mockResolvedValue(order);

    await expect(service.findOne(7n, '11')).resolves.toEqual(
      expect.objectContaining({
        id: '11',
        salesOrderNumber: '79377',
        lines: [
          expect.objectContaining({
            id: '101',
            sku: 'WIDGET-1',
          }),
        ],
      }),
    );

    const findFirstArg = prismaMock.order.findFirst.mock.calls[0][0];
    expect(findFirstArg.where).toEqual({
      accountId: 7n,
      id: 11n,
    });
  });

  it('throws when an order is not found', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    await expect(service.findOne(7n, '11')).rejects.toThrow(NotFoundException);
  });

  it('throws a bad request for an invalid order id', async () => {
    await expect(service.findOne(7n, 'not-an-id')).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });
});
