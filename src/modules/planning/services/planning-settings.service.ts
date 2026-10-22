import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  DEFAULT_DEMAND_DATE_BASIS,
  DEFAULT_DEMAND_ORDER_STATUSES,
} from '../constants/planning-defaults';
import { Prisma } from '@prisma/client';
import { UpdatePlanningSettingsDto } from '../dto/update-planning-settings.dto';

export type ReplenishmentDefaults = {
  safetyStock: number;
  targetDaysOfCover: number;
  leadTimeDays: number;
  minReorderQty: number;
  locationCode: string;
};

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

  async getReplenishmentDefaults(
    accountId: bigint,
  ): Promise<ReplenishmentDefaults> {
    const settings = await this.prisma.planningSettings.findUnique({
      where: { accountId },
      select: {
        defaultSafetyStock: true,
        defaultTargetDaysOfCover: true,
        defaultLeadTimeDays: true,
        defaultMinReorderQty: true,
        defaultLocationCode: true,
      },
    });

    return {
      safetyStock: Number(settings?.defaultSafetyStock ?? 0),
      targetDaysOfCover: settings?.defaultTargetDaysOfCover ?? 30,
      leadTimeDays: settings?.defaultLeadTimeDays ?? 7,
      minReorderQty: Number(settings?.defaultMinReorderQty ?? 0),
      locationCode: settings?.defaultLocationCode ?? 'MAIN',
    };
  }

  async updateReplenishmentDefaults(
    accountId: bigint,
    dto: UpdatePlanningSettingsDto,
  ) {
    const data = {
      ...(dto.defaultSafetyStock !== undefined
        ? { defaultSafetyStock: new Prisma.Decimal(dto.defaultSafetyStock) }
        : {}),
      ...(dto.defaultTargetDaysOfCover !== undefined
        ? { defaultTargetDaysOfCover: dto.defaultTargetDaysOfCover }
        : {}),
      ...(dto.defaultLeadTimeDays !== undefined
        ? { defaultLeadTimeDays: dto.defaultLeadTimeDays }
        : {}),
      ...(dto.defaultMinReorderQty !== undefined
        ? { defaultMinReorderQty: new Prisma.Decimal(dto.defaultMinReorderQty) }
        : {}),
      ...(dto.defaultLocationCode !== undefined
        ? { defaultLocationCode: dto.defaultLocationCode.trim() }
        : {}),
    };
    return this.prisma.planningSettings.upsert({
      where: { accountId },
      create: {
        accountId,
        demandOrderStatuses: [...DEFAULT_DEMAND_ORDER_STATUSES],
        ...data,
      },
      update: data,
    });
  }
}
