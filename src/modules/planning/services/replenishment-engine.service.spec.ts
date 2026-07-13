import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ReplenishmentEngineService } from './replenishment-engine.service';
import { SalesDailyService } from './sales-daily.service';
import { InventoryPlanningService } from 'src/modules/inventory/services/inventory-planning.service';

describe('ReplenishmentEngineService', () => {
  let service: ReplenishmentEngineService;

  const prismaMock = {
    product: {
      findFirst: jest.fn(),
    },
    replenishmentRule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    reorderRecommendation: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const salesDailyServiceMock = {
    getAverageDailySales: jest.fn(),
  };

  const inventoryPlanningServiceMock = {
    getPlanningPosition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplenishmentEngineService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: SalesDailyService,
          useValue: salesDailyServiceMock,
        },
        {
          provide: InventoryPlanningService,
          useValue: inventoryPlanningServiceMock,
        },
      ],
    }).compile();

    service = module.get<ReplenishmentEngineService>(
      ReplenishmentEngineService,
    );

    jest.clearAllMocks();
    prismaMock.product.findFirst.mockResolvedValue({
      excludeFromPlanning: false,
    });
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a reorder recommendation when available inventory is below reorder point', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      safetyStock: 5,
      targetDaysOfCover: 30,
      overrideLeadTimeDays: 7,
      minReorderQty: 0,
      isActive: true,
    });

    salesDailyServiceMock.getAverageDailySales.mockResolvedValue(2);

    inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: 10,
      qtyReserved: 0,
      qtyIncoming: 0,
      qtyAvailable: 10,
    });

    prismaMock.reorderRecommendation.create.mockResolvedValue({
      id: 100n,
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      recommendedQty: '50.00',
    });

    const result: Awaited<
      ReturnType<ReplenishmentEngineService['generateForProduct']>
    > = await service.generateForProduct(1n, 2n, 'MAIN');

    expect(prismaMock.replenishmentRule.findUnique).toHaveBeenCalledWith({
      where: {
        accountId_productId: {
          accountId: 1n,
          productId: 2n,
        },
      },
    });

    expect(salesDailyServiceMock.getAverageDailySales).toHaveBeenCalledWith(
      1n,
      2n,
      30,
    );

    expect(
      inventoryPlanningServiceMock.getPlanningPosition,
    ).toHaveBeenCalledWith(1n, 2n, 'MAIN');

    expect(result.calculation.shouldReorder).toBe(true);
    expect(result.calculation.reorderPoint).toBe(19);
    expect(result.calculation.targetStock).toBe(65);
    expect(result.calculation.recommendedQty).toBe(55);

    expect(prismaMock.reorderRecommendation.create).toHaveBeenCalled();
  });

  it('does not recommend reorder when available inventory is above reorder point', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      safetyStock: 5,
      targetDaysOfCover: 30,
      overrideLeadTimeDays: 7,
      minReorderQty: 0,
      isActive: true,
    });

    salesDailyServiceMock.getAverageDailySales.mockResolvedValue(2);

    inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: 24,
      qtyReserved: 0,
      qtyIncoming: 0,
      qtyAvailable: 24,
    });

    const result: Awaited<
      ReturnType<ReplenishmentEngineService['generateForProduct']>
    > = await service.generateForProduct(1n, 2n, 'MAIN');

    expect(result.calculation.shouldReorder).toBe(false);
    expect(result.calculation.reorderPoint).toBe(19);
    expect(result.calculation.targetStock).toBe(65);
    expect(result.calculation.rawRecommendedQty).toBe(0);
    expect(result.calculation.recommendedQty).toBe(0);

    expect(prismaMock.reorderRecommendation.updateMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        productId: 2n,
        locationCode: 'MAIN',
        status: 'open',
      },
      data: {
        status: 'superseded',
      },
    });
    expect(prismaMock.reorderRecommendation.create).not.toHaveBeenCalled();
  });

  it('applies minimum reorder quantity when computed qty is smaller', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      safetyStock: 5,
      targetDaysOfCover: 15,
      overrideLeadTimeDays: 7,
      minReorderQty: 12,
      isActive: true,
    });

    salesDailyServiceMock.getAverageDailySales.mockResolvedValue(1);

    inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: 11,
      qtyReserved: 0,
      qtyIncoming: 0,
      qtyAvailable: 11,
    });

    prismaMock.reorderRecommendation.create.mockResolvedValue({
      id: 102n,
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      recommendedQty: '12.00',
    });

    const result = await service.generateForProduct(1n, 2n, 'MAIN');
    expect(result.calculation.shouldReorder).toBe(true);

    // avgDailySales = 1
    // leadTimeDemand = 1 * 7 = 7
    // reorderPoint = 7 + 5 = 12
    // targetStock = (1 * 15) + 5 = 20
    // rawRecommendedQty = 20 - 11 = 9
    // minReorderQty = 12 => recommendedQty should become 12

    expect(result.calculation.reorderPoint).toBe(12);
    expect(result.calculation.targetStock).toBe(20);
    expect(result.calculation.rawRecommendedQty).toBe(9);
    expect(result.calculation.recommendedQty).toBe(12);

    expect(prismaMock.reorderRecommendation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recommendedQty: '12',
      }) as Record<string, unknown>,
    });
  });

  it('does not persist recommendation when dryRun is true', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      safetyStock: 5,
      targetDaysOfCover: 30,
      overrideLeadTimeDays: 7,
      minReorderQty: 12,
      isActive: true,
    });

    salesDailyServiceMock.getAverageDailySales.mockResolvedValue(0.4);

    inventoryPlanningServiceMock.getPlanningPosition.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: 7,
      qtyReserved: 0,
      qtyIncoming: 0,
      qtyAvailable: 7,
    });

    const result = await service.generateForProduct(1n, 2n, 'MAIN', true);

    expect(prismaMock.reorderRecommendation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.reorderRecommendation.create).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.recommendation).toBeNull();
  });

  it('throws when no replenishment rule exists', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue(null);

    await expect(service.generateForProduct(1n, 2n, 'MAIN')).rejects.toThrow(
      'No replenishment rule found',
    );
  });

  it('throws when replenishment rule is inactive', async () => {
    prismaMock.replenishmentRule.findUnique.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      safetyStock: 5,
      targetDaysOfCover: 30,
      overrideLeadTimeDays: 7,
      minReorderQty: 0,
      isActive: false,
    });

    await expect(service.generateForProduct(1n, 2n, 'MAIN')).rejects.toThrow(
      'inactive',
    );
  });

  it('refuses to plan an excluded product', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      excludeFromPlanning: true,
    });

    await expect(service.generateForProduct(1n, 2n, 'MAIN')).rejects.toThrow(
      'excluded from planning',
    );
    expect(prismaMock.replenishmentRule.findUnique).not.toHaveBeenCalled();
  });

  it('omits excluded products from account planning runs', async () => {
    prismaMock.replenishmentRule.findMany.mockResolvedValue([]);

    await service.generateForAccount(1n, 'MAIN');

    expect(prismaMock.replenishmentRule.findMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        isActive: true,
        product: { excludeFromPlanning: false },
      },
      orderBy: { productId: 'asc' },
    });
  });
});
