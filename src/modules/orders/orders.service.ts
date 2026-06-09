import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus, Prisma } from '@prisma/client';

type OrderInput = {
  accountId: bigint;
  createOrderDto: CreateOrderDto;
};

const salesOrderInclude = {
  orderLines: {
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.OrderInclude;

type SalesOrderRecord = Prisma.OrderGetPayload<{
  include: typeof salesOrderInclude;
}>;

type SalesOrderLineResponse = {
  id: string;
  accountId: string;
  orderId: string;
  productId: string | null;
  channelLineId: string | null;
  sku: string | null;
  productName: string | null;
  quantity: string;
  unitPrice: string | null;
  lineTotal: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
  } | null;
};

type SalesOrderResponse = {
  id: string;
  accountId: string;
  salesOrderNumber: string;
  channel: string;
  channelOrderId: string;
  status: OrderStatus;
  orderedAt: string;
  customerName: string | null;
  customerEmail: string | null;
  currencyCode: string | null;
  orderTotal: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesOrderLineResponse[];
  orderLines: SalesOrderLineResponse[];
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private readonly orderInclude = salesOrderInclude;

  private parseOrderId(orderId: string): bigint {
    try {
      return BigInt(orderId);
    } catch {
      throw new BadRequestException('Order id must be a valid integer');
    }
  }

  private nullableDecimalToString(value: Prisma.Decimal | null): string | null {
    return value === null ? null : value.toString();
  }

  private mapSalesOrderLine(
    line: SalesOrderRecord['orderLines'][number],
  ): SalesOrderLineResponse {
    return {
      id: line.id.toString(),
      accountId: line.accountId.toString(),
      orderId: line.orderId.toString(),
      productId: line.productId?.toString() ?? null,
      channelLineId: line.channelLineId,
      sku: line.sku,
      productName: line.productName,
      quantity: line.quantity.toString(),
      unitPrice: this.nullableDecimalToString(line.unitPrice),
      lineTotal: this.nullableDecimalToString(line.lineTotal),
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
      product: line.product
        ? {
            id: line.product.id.toString(),
            sku: line.product.sku,
            name: line.product.name,
          }
        : null,
    };
  }

  private mapSalesOrder(order: SalesOrderRecord): SalesOrderResponse {
    const lines = order.orderLines.map((line) => this.mapSalesOrderLine(line));

    return {
      id: order.id.toString(),
      accountId: order.accountId.toString(),
      salesOrderNumber: order.channelOrderId,
      channel: order.channel,
      channelOrderId: order.channelOrderId,
      status: order.status,
      orderedAt: order.orderedAt.toISOString(),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      currencyCode: order.currencyCode,
      orderTotal: this.nullableDecimalToString(order.orderTotal),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lines,
      orderLines: lines,
    };
  }

  async create(input: OrderInput) {
    const accountId = input.accountId;
    const createOrderDto = input.createOrderDto;

    const order = await this.prisma.order.create({
      data: {
        accountId,
        channel: createOrderDto.channel,
        channelOrderId: createOrderDto.channelOrderId,
        status: createOrderDto.status as OrderStatus,
        orderedAt: new Date(createOrderDto.orderedAt),
        customerName: createOrderDto.customerName,
        customerEmail: createOrderDto.customerEmail,
        currencyCode: createOrderDto.currencyCode,
        orderTotal: createOrderDto.orderTotal
          ? new Prisma.Decimal(createOrderDto.orderTotal)
          : undefined,
        orderLines: {
          create: createOrderDto.lines.map((line) => ({
            accountId,
            productId: line.productId ? BigInt(line.productId) : undefined,
            channelLineId: line.channelLineId,
            sku: line.sku,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice
              ? new Prisma.Decimal(line.unitPrice)
              : undefined,
            lineTotal: line.lineTotal
              ? new Prisma.Decimal(line.lineTotal)
              : undefined,
          })),
        },
      },
      include: { orderLines: true },
    });

    if (['processing', 'paid', 'completed'].includes(createOrderDto.status)) {
      for (const line of order.orderLines) {
        await this.inventoryService.postSaleEvent(accountId, line.id);
      }
    }

    return this.prisma.order.findUnique({
      where: {
        accountId,
        id: order.id,
      },
      include: { orderLines: true },
    });
  }

  async cancel(accountId: bigint, orderId: string) {
    const id = BigInt(orderId);
    let order = await this.prisma.order.findFirst({
      where: {
        id,
        accountId: accountId,
      },
      include: {
        orderLines: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order = await this.prisma.order.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { orderLines: true },
    });

    for (const line of order.orderLines) {
      await this.inventoryService.postSaleReversal(accountId, line.id);
    }
    return order;
  }

  async findAll(accountId: bigint) {
    const orders = await this.prisma.order.findMany({
      where: { accountId: accountId },
      include: this.orderInclude,
      orderBy: { orderedAt: 'desc' },
    });

    return orders.map((order) => this.mapSalesOrder(order));
  }

  async search(accountId: bigint, query: GetOrdersQueryDto = {}) {
    const take = query.take ?? 25;
    const skip = query.skip ?? 0;
    const search = query.q?.trim();
    const orderedAt: Prisma.DateTimeFilter = {};

    if (query.orderedFrom) {
      orderedAt.gte = new Date(query.orderedFrom);
    }

    if (query.orderedTo) {
      orderedAt.lte = new Date(query.orderedTo);
    }

    const where: Prisma.OrderWhereInput = {
      accountId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerEmail
        ? {
            customerEmail: {
              contains: query.customerEmail,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(Object.keys(orderedAt).length ? { orderedAt } : {}),
      ...(search
        ? {
            OR: [
              {
                channelOrderId: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                customerName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                customerEmail: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                orderLines: {
                  some: {
                    OR: [
                      {
                        sku: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        productName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        channelLineId: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.mapSalesOrder(order)),
      total,
      take,
      skip,
    };
  }

  async findOne(accountId: bigint, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        accountId,
        id: this.parseOrderId(orderId),
      },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapSalesOrder(order);
  }
}
