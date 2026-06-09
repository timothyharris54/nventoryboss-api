import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  DEFAULT_DEMAND_DATE_BASIS,
  DEFAULT_DEMAND_ORDER_STATUSES,
} from '../constants/planning-defaults';

@Injectable()
export class PlanningSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDemandOrderStatuses(accountId: bigint): Promise<string[]> {
    this.prisma.planningSettings;
    const settings = await this.prisma.planningSettings.findUnique({
      where: { accountId },
      select: { demandOrderStatuses: true },
    });

    if (settings?.demandOrderStatuses?.length) {
      return settings.demandOrderStatuses;
    }

    return [...DEFAULT_DEMAND_ORDER_STATUSES];
  }

  async getDemandDateBasis(accountId: bigint): Promise<string> {
    const settings = await this.prisma.planningSettings.findUnique({
      where: { accountId },
      select: { demandDateBasis: true },
    });

    return settings?.demandDateBasis ?? DEFAULT_DEMAND_DATE_BASIS;
  }
}
