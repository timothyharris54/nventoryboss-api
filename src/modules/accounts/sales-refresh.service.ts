import { Injectable } from '@nestjs/common';
import { WoocommerceService } from 'src/modules/ecommerce/woocommerce/woocommerce.service';
import { ReplenishmentEngineService } from 'src/modules/planning/services/replenishment-engine.service';
import { SalesDailyService } from 'src/modules/planning/services/sales-daily.service';
import { SalesRefreshDto } from './dto/sales-refresh.dto';

const DEFAULT_SALES_REFRESH_LOOKBACK_DAYS = 120;
const DEFAULT_LOCATION_CODE = 'MAIN';

@Injectable()
export class SalesRefreshService {
  constructor(
    private readonly woocommerceService: WoocommerceService,
    private readonly salesDailyService: SalesDailyService,
    private readonly replenishmentEngineService: ReplenishmentEngineService,
  ) {}

  async refreshForAccount(accountId: bigint, dto: SalesRefreshDto = {}) {
    const lookbackDays =
      dto.lookbackDays ?? DEFAULT_SALES_REFRESH_LOOKBACK_DAYS;
    const locationCode = dto.locationCode || DEFAULT_LOCATION_CODE;
    const now = new Date();
    const from = this.daysAgoUtc(now, lookbackDays);
    const activeConnections = await this.getActiveConnections(accountId);
    const channelResults: Array<{
      connection: unknown;
      products: unknown;
      orders: unknown;
      inventoryImpact: unknown;
    }> = [];

    for (const connection of activeConnections) {
      if (connection.provider === 'woocommerce') {
        const connectionId = BigInt(connection.id);
        const products = await this.woocommerceService.syncProducts(
          accountId,
          connectionId,
        );
        const orders = await this.woocommerceService.syncOrders(
          accountId,
          connectionId,
        );
        const inventoryImpact =
          await this.woocommerceService.postOrderInventoryImpact(
            accountId,
            locationCode,
          );

        channelResults.push({
          connection,
          products,
          orders,
          inventoryImpact,
        });
      }
    }

    const salesDaily = await this.salesDailyService.rebuildForAccount(
      accountId,
      from,
      now,
    );

    const replenishment = dto.runReplenishment
      ? await this.replenishmentEngineService.generateForAccount(
          accountId,
          locationCode,
          Boolean(dto.dryRunReplenishment),
        )
      : null;

    return {
      accountId,
      lookbackDays,
      salesDailyWindow: {
        from: from.toISOString(),
        to: now.toISOString(),
      },
      channels: channelResults,
      salesDaily,
      replenishment,
    };
  }

  private async getActiveConnections(accountId: bigint) {
    const connections = await this.woocommerceService.getConnections(accountId);
    return connections.filter((connection) => connection.configured);
  }

  private daysAgoUtc(anchor: Date, days: number): Date {
    const date = new Date(anchor);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  }
}
