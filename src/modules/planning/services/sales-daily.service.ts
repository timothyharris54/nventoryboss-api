import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PlanningSettingsService } from './planning-settings.service';

@Injectable()
export class SalesDailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planningSettingsService: PlanningSettingsService,
  ) {}

  async rebuildForAccount(
    accountId: bigint,
    fromInput: Date,
    toInput: Date,
  ): Promise<{
    deleted: number;
    insertedEstimate: number;
    statusesUsed: string[];
  }> {
    const from = this.startOfDayUtc(fromInput);
    const toExclusive = this.startOfNextDayUtc(toInput);

    if (toExclusive <= from) {
      throw new BadRequestException(
        'Invalid rebuild range: to must be on or after from.',
      );
    }

    const demandStatuses =
      await this.planningSettingsService.getDemandOrderStatuses(accountId);

    const demandDateBasis =
      await this.planningSettingsService.getDemandDateBasis(accountId);

    if (demandDateBasis !== 'orderedAt') {
      throw new BadRequestException(
        `Demand date basis '${demandDateBasis}' is not implemented yet. MVP currently supports 'orderedAt' only.`,
      );
    }

    if (!demandStatuses.length) {
      throw new BadRequestException(
        'No demand order statuses configured for this account.',
      );
    }
    // Note: We perform the delete and insert in a single transaction to ensure data integrity
    //  and to get an accurate count of deleted rows.
    const deleted = await this.prisma.$transaction(async (tx) => {
      const deleteResult = await tx.$executeRaw`
        DELETE FROM "SalesDaily"
        WHERE "accountId" = ${accountId}
          AND "salesDate" >= ${from}
          AND "salesDate" < ${toExclusive}
      `;

      await tx.$executeRaw(
        this.buildInsertSalesDailySql(
          accountId,
          from,
          toExclusive,
          demandStatuses,
        ),
      );

      return Number(deleteResult);
    });

    const insertedEstimate = await this.countRowsInRange(
      accountId,
      from,
      toExclusive,
    );

    return {
      deleted,
      insertedEstimate,
      statusesUsed: demandStatuses,
    };
  }

  async rebuildForProduct(
    accountId: bigint,
    productId: bigint,
    fromInput: Date,
    toInput: Date,
  ): Promise<{
    deleted: number;
    insertedEstimate: number;
    statusesUsed: string[];
  }> {
    const from = this.startOfDayUtc(fromInput);
    const toExclusive = this.startOfNextDayUtc(toInput);

    if (toExclusive <= from) {
      throw new BadRequestException(
        'Invalid rebuild range: to must be on or after from.',
      );
    }

    const demandStatuses =
      await this.planningSettingsService.getDemandOrderStatuses(accountId);

    const demandDateBasis =
      await this.planningSettingsService.getDemandDateBasis(accountId);

    if (demandDateBasis !== 'orderedAt') {
      throw new BadRequestException(
        `Demand date basis '${demandDateBasis}' is not implemented yet. MVP currently supports 'orderedAt' only.`,
      );
    }

    if (!demandStatuses.length) {
      throw new BadRequestException(
        'No demand order statuses configured for this account.',
      );
    }
    // Note: We perform the delete and insert in a single transaction to ensure data integrity
    //  and to get an accurate count of deleted rows.
    const deleted = await this.prisma.$transaction(async (tx) => {
      const deleteResult = await tx.$executeRaw`
        DELETE FROM "SalesDaily"
        WHERE "accountId" = ${accountId}
          AND "productId" = ${productId}
          AND "salesDate" >= ${from}
          AND "salesDate" < ${toExclusive}
      `;

      await tx.$executeRaw(
        this.buildInsertSalesDailyForProductSql(
          accountId,
          productId,
          from,
          toExclusive,
          demandStatuses,
        ),
      );

      return Number(deleteResult);
    });
    // The count after the insert gives us an accurate number of rows inserted
    // for this product in the date range
    const insertedEstimate = await this.countRowsInRangeForProduct(
      accountId,
      productId,
      from,
      toExclusive,
    );
    // In practice, the insertedEstimate should match the number of rows
    // we just inserted for this product and date range.
    return {
      deleted,
      insertedEstimate,
      statusesUsed: demandStatuses,
    };
  }

  async getAverageDailySales(
    accountId: bigint,
    productId: bigint,
    lookbackDays: number,
    anchorDate = new Date(),
  ): Promise<number> {
    if (lookbackDays <= 0) {
      throw new BadRequestException('lookbackDays must be greater than 0');
    }

    const endExclusive = this.startOfNextDayUtc(anchorDate);
    const startInclusive = new Date(endExclusive);
    startInclusive.setUTCDate(startInclusive.getUTCDate() - lookbackDays);

    const result = await this.prisma.salesDaily.aggregate({
      where: {
        accountId,
        productId,
        salesDate: {
          gte: startInclusive,
          lt: endExclusive,
        },
      },
      _sum: {
        unitsSold: true,
      },
    });

    const totalUnits = Number(result._sum.unitsSold ?? 0);
    return totalUnits / lookbackDays;
  }

  private buildInsertSalesDailySql(
    accountId: bigint,
    from: Date,
    toExclusive: Date,
    demandStatuses: string[],
  ): Prisma.Sql {
    const statusSqlValues = demandStatuses.map((status) => Prisma.sql`${status}`);

    // Note: The SQL uses COALESCE to handle cases where lineTotal or unitPrice might be null.
    return Prisma.sql`
      INSERT INTO "SalesDaily" (
        "accountId",
        "productId",
        "salesDate",
        "unitsSold",
        "revenue",
        "createdAt",
        "updatedAt"
      )
      SELECT
        o."accountId" AS "accountId",
        ol."productId" AS "productId",
        date_trunc('day', o."orderedAt") AS "salesDate",
        SUM(ol."quantity")::numeric(12,2) AS "unitsSold",
        SUM(
          COALESCE(
            ol."lineTotal",
            (ol."quantity" * ol."unitPrice"),
            0
          )
        )::numeric(12,2) AS "revenue",
        NOW() AS "createdAt",
        NOW() AS "updatedAt"
      FROM "Order" o
      INNER JOIN "OrderLine" ol
        ON ol."orderId" = o."id"
       AND ol."accountId" = o."accountId"
      WHERE o."accountId" = ${accountId}
        AND o."orderedAt" >= ${from}
        AND o."orderedAt" < ${toExclusive}
        AND o."status" IN (${Prisma.join(statusSqlValues)})
        AND ol."productId" IS NOT NULL
      GROUP BY
        o."accountId",
        ol."productId",
        date_trunc('day', o."orderedAt")
    `;
  }
  // The SQL for rebuilding sales daily for a specific product is
  // similar to the overall rebuild, but includes an additional filter for the productId.
  private buildInsertSalesDailyForProductSql(
    accountId: bigint,
    productId: bigint,
    from: Date,
    toExclusive: Date,
    demandStatuses: string[],
  ): Prisma.Sql {
    const statusSqlValues = demandStatuses.map((status) => Prisma.sql`${status}`);

    return Prisma.sql`
      INSERT INTO "SalesDaily" (
        "accountId",
        "productId",
        "salesDate",
        "unitsSold",
        "revenue",
        "createdAt",
        "updatedAt"
      )
      SELECT
        o."accountId" AS "accountId",
        ol."productId" AS "productId",
        date_trunc('day', o."orderedAt") AS "salesDate",
        SUM(ol."quantity")::numeric(12,2) AS "unitsSold",
        SUM(
          COALESCE(
            ol."lineTotal",
            (ol."quantity" * ol."unitPrice"),
            0
          )
        )::numeric(12,2) AS "revenue",
        NOW() AS "createdAt",
        NOW() AS "updatedAt"
      FROM "Order" o
      INNER JOIN "OrderLine" ol
        ON ol."orderId" = o."id"
       AND ol."accountId" = o."accountId"
      WHERE o."accountId" = ${accountId}
        AND ol."productId" = ${productId}
        AND o."orderedAt" >= ${from}
        AND o."orderedAt" < ${toExclusive}
        AND o."status" IN (${Prisma.join(statusSqlValues)})
        AND ol."productId" IS NOT NULL
      GROUP BY
        o."accountId",
        ol."productId",
        date_trunc('day', o."orderedAt")
    `;
  }

  private async countRowsInRange(
    accountId: bigint,
    from: Date,
    toExclusive: Date,
  ): Promise<number> {
    return this.prisma.salesDaily.count({
      where: {
        accountId,
        salesDate: {
          gte: from,
          lt: toExclusive,
        },
      },
    });
  }

  private async countRowsInRangeForProduct(
    accountId: bigint,
    productId: bigint,
    from: Date,
    toExclusive: Date,
  ): Promise<number> {
    return this.prisma.salesDaily.count({
      where: {
        accountId,
        productId,
        salesDate: {
          gte: from,
          lt: toExclusive,
        },
      },
    });
  }

  private startOfDayUtc(input: Date): Date {
    const d = new Date(input);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private startOfNextDayUtc(input: Date): Date {
    const d = this.startOfDayUtc(input);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
}
