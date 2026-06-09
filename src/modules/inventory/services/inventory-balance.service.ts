import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  PurchaseOrderStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

type TxOrClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InventoryBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateInventoryBalanceForProduct(
    accountId: bigint,
    productId: bigint,
    locationCode: string,
    tx?: TxOrClient,
  ) {
    const db = tx ?? this.prisma;

    const [ledgerAgg, openPoLinesAgg, existingBalance] = await Promise.all([
      db.inventoryLedger.aggregate({
        where: {
          accountId,
          productId,
          locationCode,
        },
        _sum: {
          quantityDelta: true,
        },
      }),

      db.purchaseOrderLine.aggregate({
        where: {
          accountId,
          productId,
          purchaseOrder: {
            accountId,
            locationCode,
            status: {
              in: [
                PurchaseOrderStatus.submitted,
                PurchaseOrderStatus.partially_received,
              ],
            },
          },
        },
        _sum: {
          orderedQty: true,
          receivedQty: true,
        },
      }),

      db.inventoryBalance.findUnique({
        where: {
          accountId_productId_locationCode: {
            accountId,
            productId,
            locationCode,
          },
        },
      }),
    ]);

    const qtyOnHand = new Prisma.Decimal(ledgerAgg._sum.quantityDelta ?? 0);
    const totalOrdered = new Prisma.Decimal(
      openPoLinesAgg._sum.orderedQty ?? 0,
    );
    const totalReceived = new Prisma.Decimal(
      openPoLinesAgg._sum.receivedQty ?? 0,
    );
    const activeReservationsAgg = await db.inventoryReservation.aggregate({
      where: {
        accountId,
        productId,
        locationCode,
        status: ReservationStatus.active,
      },
      _sum: {
        reservedQty: true,
      },
    });
    // Compute reserved quantity and more accurately compute qtyAvailable
    const qtyReserved = new Prisma.Decimal(
      activeReservationsAgg._sum.reservedQty ?? 0,
    );
    const rawIncoming = totalOrdered.minus(totalReceived);
    const qtyIncoming = rawIncoming.lessThan(0)
      ? new Prisma.Decimal(0)
      : rawIncoming;

    const qtyAvailable = qtyOnHand.minus(qtyReserved);

    return db.inventoryBalance.upsert({
      where: {
        accountId_productId_locationCode: {
          accountId,
          productId,
          locationCode,
        },
      },
      update: {
        qtyOnHand,
        qtyIncoming,
        qtyReserved,
        qtyAvailable,
        lastCalculatedAt: new Date(),
      },
      create: {
        accountId,
        productId,
        locationCode,
        qtyOnHand,
        qtyIncoming,
        qtyReserved,
        qtyAvailable,
        lastCalculatedAt: new Date(),
      },
    });
  }
  async recalculateInventoryBalancesForProducts(
    accountId: bigint,
    items: Array<{ productId: bigint; locationCode: string }>,
    tx?: TxOrClient,
  ) {
    const seen = new Set<string>();

    for (const item of items) {
      const key = `${item.productId.toString()}::${item.locationCode}`;

      if (seen.has(key)) continue;

      seen.add(key);

      await this.recalculateInventoryBalanceForProduct(
        accountId,
        item.productId,
        item.locationCode,
        tx,
      );
    }
  }
}
