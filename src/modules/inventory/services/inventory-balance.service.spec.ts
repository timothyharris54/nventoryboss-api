import { Prisma, PurchaseOrderStatus, ReservationStatus } from '@prisma/client';
import { InventoryBalanceService } from './inventory-balance.service';

describe('InventoryBalanceService', () => {
  let service: InventoryBalanceService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      inventoryLedger: {
        aggregate: jest.fn(),
      },
      inventoryReservation: {
        aggregate: jest.fn(),
      },
      purchaseOrderLine: {
        aggregate: jest.fn(),
      },
      inventoryBalance: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new InventoryBalanceService(prismaMock);
  });

  describe('recalculateInventoryBalanceForProduct', () => {
    it('recalculates qtyOnHand and qtyIncoming and preserves qtyReserved', async () => {
      const accountId = 1n;
      const productId = 101n;
      const locationCode = 'MAIN';

      prismaMock.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          quantityDelta: new Prisma.Decimal(18),
        },
      });

      prismaMock.purchaseOrderLine.aggregate.mockResolvedValue({
        _sum: {
          orderedQty: new Prisma.Decimal(20),
          receivedQty: new Prisma.Decimal(6),
        },
      });

      prismaMock.inventoryReservation.aggregate.mockResolvedValue({
        _sum: {
          reservedQty: new Prisma.Decimal(4),
        },
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        accountId,
        productId,
        locationCode,
        qtyReserved: new Prisma.Decimal(4),
      });

      prismaMock.inventoryBalance.upsert.mockResolvedValue({
        accountId,
        productId,
        locationCode,
        qtyOnHand: new Prisma.Decimal(18),
        qtyIncoming: new Prisma.Decimal(14),
        qtyReserved: new Prisma.Decimal(4),
        qtyAvailable: new Prisma.Decimal(14),
      });

      const result = await service.recalculateInventoryBalanceForProduct(
        accountId,
        productId,
        locationCode,
      );

      expect(prismaMock.inventoryLedger.aggregate).toHaveBeenCalledWith({
        where: {
          accountId,
          productId,
          locationCode,
        },
        _sum: {
          quantityDelta: true,
        },
      });

      expect(prismaMock.purchaseOrderLine.aggregate).toHaveBeenCalledWith({
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
      });

      expect(prismaMock.inventoryReservation.aggregate).toHaveBeenCalledWith({
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

      expect(prismaMock.inventoryBalance.findUnique).toHaveBeenCalledWith({
        where: {
          accountId_productId_locationCode: {
            accountId,
            productId,
            locationCode,
          },
        },
      });

      expect(prismaMock.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: {
          accountId_productId_locationCode: {
            accountId,
            productId,
            locationCode,
          },
        },
        update: {
          qtyOnHand: new Prisma.Decimal(18),
          qtyIncoming: new Prisma.Decimal(14),
          qtyReserved: new Prisma.Decimal(4),
          qtyAvailable: new Prisma.Decimal(14),
          lastCalculatedAt: expect.any(Date),
        },
        create: {
          accountId,
          productId,
          locationCode,
          qtyOnHand: new Prisma.Decimal(18),
          qtyIncoming: new Prisma.Decimal(14),
          qtyReserved: new Prisma.Decimal(4),
          qtyAvailable: new Prisma.Decimal(14),
          lastCalculatedAt: expect.any(Date),
        },
      });

      expect(result.qtyOnHand.toString()).toBe('18');
      expect(result.qtyIncoming.toString()).toBe('14');
      expect(result.qtyReserved.toString()).toBe('4');
      expect(result.qtyAvailable.toString()).toBe('14');
    });

    it('creates a balance with zero reserved when no existing balance exists', async () => {
      prismaMock.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          quantityDelta: new Prisma.Decimal(7),
        },
      });

      prismaMock.purchaseOrderLine.aggregate.mockResolvedValue({
        _sum: {
          orderedQty: new Prisma.Decimal(5),
          receivedQty: new Prisma.Decimal(2),
        },
      });

      prismaMock.inventoryReservation.aggregate.mockResolvedValue({
        _sum: {
          reservedQty: new Prisma.Decimal(0),
        },
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue(null);

      prismaMock.inventoryBalance.upsert.mockResolvedValue({
        accountId: 1n,
        productId: 101n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal(7),
        qtyIncoming: new Prisma.Decimal(3),
        qtyReserved: new Prisma.Decimal(0),
        qtyAvailable: new Prisma.Decimal(7),
      });

      const result = await service.recalculateInventoryBalanceForProduct(
        1n,
        101n,
        'MAIN',
      );

      expect(result.qtyOnHand.toString()).toBe('7');
      expect(result.qtyIncoming.toString()).toBe('3');
      expect(result.qtyReserved.toString()).toBe('0');
      expect(result.qtyAvailable.toString()).toBe('7');

      expect(prismaMock.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: {
          accountId_productId_locationCode: {
            accountId: 1n,
            productId: 101n,
            locationCode: 'MAIN',
          },
        },
        update: {
          qtyOnHand: new Prisma.Decimal(7),
          qtyIncoming: new Prisma.Decimal(3),
          qtyReserved: new Prisma.Decimal(0),
          qtyAvailable: new Prisma.Decimal(7),
          lastCalculatedAt: expect.any(Date),
        },
        create: {
          accountId: 1n,
          productId: 101n,
          locationCode: 'MAIN',
          qtyOnHand: new Prisma.Decimal(7),
          qtyIncoming: new Prisma.Decimal(3),
          qtyReserved: new Prisma.Decimal(0),
          qtyAvailable: new Prisma.Decimal(7),
          lastCalculatedAt: expect.any(Date),
        },
      });
    });

    it('clamps qtyIncoming to zero when received exceeds ordered', async () => {
      prismaMock.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          quantityDelta: new Prisma.Decimal(9),
        },
      });

      prismaMock.purchaseOrderLine.aggregate.mockResolvedValue({
        _sum: {
          orderedQty: new Prisma.Decimal(5),
          receivedQty: new Prisma.Decimal(8),
        },
      });

      prismaMock.inventoryReservation.aggregate.mockResolvedValue({
        _sum: {
          reservedQty: new Prisma.Decimal(2),
        },
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        qtyReserved: new Prisma.Decimal(2),
      });

      prismaMock.inventoryBalance.upsert.mockResolvedValue({
        accountId: 1n,
        productId: 101n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal(9),
        qtyIncoming: new Prisma.Decimal(0),
        qtyReserved: new Prisma.Decimal(2),
        qtyAvailable: new Prisma.Decimal(7),
      });

      const result = await service.recalculateInventoryBalanceForProduct(
        1n,
        101n,
        'MAIN',
      );

      expect(result.qtyOnHand.toString()).toBe('9');
      expect(result.qtyIncoming.toString()).toBe('0');
      expect(result.qtyReserved.toString()).toBe('2');
      expect(result.qtyAvailable.toString()).toBe('7');

      expect(prismaMock.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: {
          accountId_productId_locationCode: {
            accountId: 1n,
            productId: 101n,
            locationCode: 'MAIN',
          },
        },
        update: {
          qtyOnHand: new Prisma.Decimal(9),
          qtyIncoming: new Prisma.Decimal(0),
          qtyReserved: new Prisma.Decimal(2),
          qtyAvailable: new Prisma.Decimal(7),
          lastCalculatedAt: expect.any(Date),
        },
        create: {
          accountId: 1n,
          productId: 101n,
          locationCode: 'MAIN',
          qtyOnHand: new Prisma.Decimal(9),
          qtyIncoming: new Prisma.Decimal(0),
          qtyReserved: new Prisma.Decimal(2),
          qtyAvailable: new Prisma.Decimal(7),
          lastCalculatedAt: expect.any(Date),
        },
      });
    });

    it('counts only submitted and partially_received purchase orders as incoming', async () => {
      prismaMock.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          quantityDelta: new Prisma.Decimal(0),
        },
      });

      prismaMock.purchaseOrderLine.aggregate.mockResolvedValue({
        _sum: {
          orderedQty: new Prisma.Decimal(0),
          receivedQty: new Prisma.Decimal(0),
        },
      });

      prismaMock.inventoryReservation.aggregate.mockResolvedValue({
        _sum: {
          reservedQty: new Prisma.Decimal(0),
        },
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue(null);

      prismaMock.inventoryBalance.upsert.mockResolvedValue({
        accountId: 1n,
        productId: 101n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal(0),
        qtyIncoming: new Prisma.Decimal(0),
        qtyReserved: new Prisma.Decimal(0),
        qtyAvailable: new Prisma.Decimal(0),
      });

      await service.recalculateInventoryBalanceForProduct(1n, 101n, 'MAIN');

      expect(prismaMock.purchaseOrderLine.aggregate).toHaveBeenCalledWith({
        where: {
          accountId: 1n,
          productId: 101n,
          purchaseOrder: {
            accountId: 1n,
            locationCode: 'MAIN',
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
      });
    });
  });
});
