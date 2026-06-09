import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { InventoryPlanningService } from 'src/modules/inventory/services/inventory-planning.service';

describe('InventoryPlanningService', () => {
  let service: InventoryPlanningService;

  const prismaMock = {
    inventoryBalance: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryPlanningService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<InventoryPlanningService>(InventoryPlanningService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns zeros when no balance exists', async () => {
    prismaMock.inventoryBalance.findUnique.mockResolvedValue(null);

    const result = await service.getPlanningPosition(1n, 2n, 'MAIN');

    expect(result).toEqual({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: 0,
      qtyReserved: 0,
      qtyIncoming: 0,
      qtyAvailable: 0,
    });
  });

  it('returns numeric values from inventory balance', async () => {
    prismaMock.inventoryBalance.findUnique.mockResolvedValue({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: { toString: () => '12.00', valueOf: () => 12 },
      qtyReserved: { toString: () => '3.00', valueOf: () => 3 },
      qtyIncoming: { toString: () => '5.00', valueOf: () => 5 },
      qtyAvailable: { toString: () => '14.00', valueOf: () => 14 },
    });

    const result = await service.getPlanningPosition(1n, 2n, 'MAIN');

    expect(result).toEqual({
      accountId: 1n,
      productId: 2n,
      locationCode: 'MAIN',
      qtyOnHand: 12,
      qtyReserved: 3,
      qtyIncoming: 5,
      qtyAvailable: 14,
    });
  });
});
