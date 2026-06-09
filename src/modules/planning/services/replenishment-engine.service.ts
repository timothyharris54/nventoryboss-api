import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SalesDailyService } from 'src/modules/planning/services/sales-daily.service';
import { InventoryPlanningService } from 'src/modules/inventory/services/inventory-planning.service';
import { RecommendationStatus } from '@prisma/client';

@Injectable()
export class ReplenishmentEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesDailyService: SalesDailyService,
    private readonly inventoryPlanningService: InventoryPlanningService,
  ) {}

  async generateForProduct(
    accountId: bigint,
    productId: bigint,
    locationCode: string,
    dryRun = false,
  ) {
    const rule = await this.prisma.replenishmentRule.findUnique({
      where: {
        accountId_productId: {
          accountId,
          productId,
        },
      },
    });

    if (!rule) {
      throw new NotFoundException(
        `No replenishment rule found for product ${productId.toString()}.`,
      );
    }

    if (!rule.isActive) {
      throw new BadRequestException(
        `Replenishment rule for product ${productId.toString()} is inactive.`,
      );
    }

    const avgDailySales = await this.salesDailyService.getAverageDailySales(
      accountId,
      productId,
      30,
    );

    const inventoryPosition =
      await this.inventoryPlanningService.getPlanningPosition(
        accountId,
        productId,
        locationCode,
      );

    const leadTimeDays = rule.overrideLeadTimeDays ?? 7;
    const safetyStock = Number(rule.safetyStock ?? 0);
    const targetDaysOfCover = rule.targetDaysOfCover ?? 30;
    const minReorderQty = Number(rule.minReorderQty ?? 0);

    const leadTimeDemand = avgDailySales * leadTimeDays;
    const reorderPoint = leadTimeDemand + safetyStock;
    const targetStock = avgDailySales * targetDaysOfCover + safetyStock;

    const shouldReorder = inventoryPosition.qtyAvailable <= reorderPoint;

    let rawRecommendedQty = 0;
    let recommendedQty = 0;
    let recommendation: any = null;
    const daysUntilStockout =
      avgDailySales > 0
        ? this.roundToTwo(inventoryPosition.qtyAvailable / avgDailySales)
        : null;

    if (shouldReorder) {
      rawRecommendedQty = targetStock - inventoryPosition.qtyAvailable;
      recommendedQty = Math.max(rawRecommendedQty, 0);

      if (recommendedQty > 0 && recommendedQty < minReorderQty) {
        recommendedQty = minReorderQty;
      }

      recommendedQty = this.roundToTwo(recommendedQty);
    }
    if (!dryRun) {
      await this.prisma.reorderRecommendation.updateMany({
        where: {
          accountId,
          productId,
          locationCode,
          status: RecommendationStatus.open,
        },
        data: {
          status: RecommendationStatus.superseded,
        },
      });

      if (recommendedQty > 0) {
        recommendation = await this.prisma.reorderRecommendation.create({
          data: {
            accountId,
            productId,
            locationCode,
            recommendedQty: recommendedQty.toString(),
            daysUntilStockout:
              daysUntilStockout !== null ? daysUntilStockout.toString() : null,
            reorderPoint: this.roundToTwo(reorderPoint).toString(),
            targetStock: this.roundToTwo(targetStock).toString(),
            avgDailySales30: this.roundToFour(avgDailySales).toString(),
            qtyOnHandSnapshot: this.roundToTwo(
              inventoryPosition.qtyOnHand,
            ).toString(),
            qtyIncomingSnapshot: this.roundToTwo(
              inventoryPosition.qtyIncoming,
            ).toString(),
            qtyAvailableSnapshot: this.roundToTwo(
              inventoryPosition.qtyAvailable,
            ).toString(),
          },
        });
      }
    }

    return {
      dryRun,
      rule: {
        accountId: rule.accountId,
        productId: rule.productId,
        locationCode: rule.locationCode,
        safetyStock,
        targetDaysOfCover,
        leadTimeDays,
        minReorderQty,
      },
      demand: {
        avgDailySales,
        leadTimeDemand: this.roundToTwo(leadTimeDemand),
      },
      inventory: inventoryPosition,
      calculation: {
        shouldReorder,
        reorderPoint: this.roundToTwo(reorderPoint),
        targetStock: this.roundToTwo(targetStock),
        rawRecommendedQty: this.roundToTwo(rawRecommendedQty),
        recommendedQty,
        daysUntilStockout,
      },
      recommendation,
    };
  }

  async generateForAccount(
    accountId: bigint,
    locationCode: string,
    dryRun = false,
  ) {
    const rules = await this.prisma.replenishmentRule.findMany({
      where: {
        accountId,
        isActive: true,
      },
      orderBy: {
        productId: 'asc',
      },
    });
    const results: Awaited<ReturnType<typeof this.generateForProduct>>[] = [];

    for (const rule of rules) {
      const result = await this.generateForProduct(
        accountId,
        rule.productId,
        locationCode,
        dryRun,
      );
      results.push(result);
    }

    return results;
  }

  private roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundToFour(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
