import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

export interface InventoryPlanningPosition {
  accountId: bigint;
  productId: bigint;
  locationCode: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyIncoming: number;
  qtyAvailable: number;
}

@Injectable()
export class InventoryPlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanningPosition(
    accountId: bigint,
    productId: bigint,
    locationCode: string,
  ): Promise<InventoryPlanningPosition> {
    const balance = await this.prisma.inventoryBalance.findUnique({
      where: {
        accountId_productId_locationCode: {
          accountId,
          productId,
          locationCode,
        },
      },
    });

    if (!balance) {
      return {
        accountId,
        productId,
        locationCode,
        qtyOnHand: 0,
        qtyReserved: 0,
        qtyIncoming: 0,
        qtyAvailable: 0,
      };
    }
    return {
      accountId: balance.accountId,
      productId: balance.productId,
      locationCode: balance.locationCode,
      qtyOnHand: Number(balance.qtyOnHand),
      qtyReserved: Number(balance.qtyReserved),
      qtyIncoming: Number(balance.qtyIncoming),
      qtyAvailable: Number(balance.qtyAvailable),
    };
  }
}
