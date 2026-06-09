import { PrismaService } from '../../../src/common/prisma/prisma.service';

export async function createOrder(
  prisma: PrismaService,
  accountId: bigint,
  channelOrderId: string,
  status: 'completed' | 'cancelled' | 'paid',
  orderedAt: Date,
) {
  return prisma.order.create({
    data: {
      accountId,
      channel: 'manual',
      channelOrderId,
      status,
      orderedAt,
    },
  });
}

export async function createOrderLine(
  prisma: PrismaService,
  accountId: bigint,
  orderId: bigint,
  productId: bigint,
  quantity: string,
  unitPrice: string,
  lineTotal: string,
) {
  return prisma.orderLine.create({
    data: {
      accountId,
      orderId,
      productId,
      quantity,
      unitPrice,
      lineTotal,
    },
  });
}
