import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  InventoryEventType,
  ReferenceType,
  AdjustmentReasonCodes,
  ReservationSourceType,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryBalanceService } from './services/inventory-balance.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prismaMock: any;
  let txMock: any;
  let inventoryBalanceServiceMock: any;

  beforeEach(async () => {
    txMock = {
      inventoryLedger: {
        create: jest.fn(),
      },
      inventoryReservation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(txMock)),
    };

    inventoryBalanceServiceMock = {
      recalculateInventoryBalanceForProduct: jest.fn(),
    };

    prismaMock.product = {
      findFirst: jest.fn(),
    };

    prismaMock.location = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    };

    prismaMock.orderLine = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    };

    prismaMock.inventoryLedger = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    };
    prismaMock.inventoryBalance = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    };

    prismaMock.inventoryLedger.findMany.mockResolvedValue([]);
    prismaMock.inventoryBalance.findMany.mockResolvedValue([]);

    prismaMock.inventoryReservation = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: InventoryBalanceService,
          useValue: inventoryBalanceServiceMock,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('postExternalChannelSaleEvent', () => {
    it('uses the external channel line id for idempotent sale ledger impact', async () => {
      const orderLine = {
        id: 8001n,
        accountId: 1n,
        orderId: 7001n,
        productId: 123n,
        channelLineId: '10001',
        quantity: new Prisma.Decimal('2'),
        order: {
          channel: 'woocommerce',
          channelOrderId: '9001',
          orderedAt: new Date('2026-05-30T14:15:00Z'),
        },
        product: {
          id: 123n,
        },
      };
      prismaMock.orderLine.findUnique.mockResolvedValue(orderLine);
      prismaMock.inventoryLedger.findUnique.mockResolvedValue(null);
      txMock.inventoryLedger.create.mockResolvedValue({ id: 9501n });

      await expect(
        service.postExternalChannelSaleEvent({
          accountId: 1n,
          orderLineId: 8001n,
          locationCode: 'MAIN',
        }),
      ).resolves.toEqual({
        action: 'created',
        ledgerEntry: { id: 9501n },
      });

      expect(prismaMock.inventoryLedger.findUnique).toHaveBeenCalledWith({
        where: {
          accountId_externalEventKey: {
            accountId: 1n,
            externalEventKey: '1:woocommerce:order:9001:line:10001:sale',
          },
        },
      });
      expect(txMock.inventoryLedger.create).toHaveBeenCalledWith({
        data: {
          accountId: 1n,
          productId: 123n,
          locationCode: 'MAIN',
          eventType: InventoryEventType.sale,
          quantityDelta: new Prisma.Decimal('-2'),
          referenceType: ReferenceType.order,
          referenceId: 7001n,
          externalEventKey: '1:woocommerce:order:9001:line:10001:sale',
          occurredAt: new Date('2026-05-30T14:15:00Z'),
          notes: 'Sale for woocommerce order 9001',
        },
      });
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 123n, 'MAIN', txMock);
    });

    it('returns the existing sale ledger entry when it has already posted', async () => {
      prismaMock.orderLine.findUnique.mockResolvedValue({
        id: 8001n,
        accountId: 1n,
        orderId: 7001n,
        productId: 123n,
        channelLineId: '10001',
        quantity: new Prisma.Decimal('2'),
        order: {
          channel: 'woocommerce',
          channelOrderId: '9001',
          orderedAt: new Date('2026-05-30T14:15:00Z'),
        },
        product: {
          id: 123n,
        },
      });
      prismaMock.inventoryLedger.findUnique.mockResolvedValue({ id: 9501n });

      await expect(
        service.postExternalChannelSaleEvent({
          accountId: 1n,
          orderLineId: 8001n,
        }),
      ).resolves.toEqual({
        action: 'existing',
        ledgerEntry: { id: 9501n },
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });

    it('rejects external sale posting when the order line lacks a channel line id', async () => {
      prismaMock.orderLine.findUnique.mockResolvedValue({
        id: 8001n,
        accountId: 1n,
        orderId: 7001n,
        productId: 123n,
        channelLineId: null,
        quantity: new Prisma.Decimal('2'),
        order: {
          channel: 'woocommerce',
          channelOrderId: '9001',
          orderedAt: new Date('2026-05-30T14:15:00Z'),
        },
        product: {
          id: 123n,
        },
      });

      await expect(
        service.postExternalChannelSaleEvent({
          accountId: 1n,
          orderLineId: 8001n,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('postAdjustmentEvent', () => {
    it('creates a positive adjustment ledger entry and recalculates balance', async () => {
      const occurredAt = '2026-04-18T12:00:00.000Z';

      txMock.inventoryLedger.create.mockResolvedValue({
        id: 1001n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        quantityDelta: new Prisma.Decimal('5'),
        eventType: InventoryEventType.adjustment,
        referenceType: ReferenceType.adjustment,
        occurredAt: new Date(occurredAt),
        notes: 'Added stock after manual count',
      });

      const result = await service.postAdjustmentEvent({
        accountId: 1n,
        adjustmentsDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantityDelta: '5',
          reasonCode: AdjustmentReasonCodes.manual_correction,
          notes: 'Added stock after manual count',
          occurredAt,
        },
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.inventoryLedger.create).toHaveBeenCalledWith({
        data: {
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          quantityDelta: new Prisma.Decimal('5'),
          referenceType: ReferenceType.adjustment,
          externalEventKey: `adjustment:1:11:MAIN:${new Date(occurredAt).toISOString()}:${AdjustmentReasonCodes.manual_correction}`,
          eventType: InventoryEventType.adjustment,
          occurredAt: new Date(occurredAt),
          notes: 'Added stock after manual count',
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result).toEqual({
        id: 1001n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        quantityDelta: new Prisma.Decimal('5'),
        eventType: InventoryEventType.adjustment,
        referenceType: ReferenceType.adjustment,
        occurredAt: new Date(occurredAt),
        notes: 'Added stock after manual count',
      });
    });

    it('creates a negative adjustment ledger entry and recalculates balance', async () => {
      const occurredAt = '2026-04-18T12:00:00.000Z';

      txMock.inventoryLedger.create.mockResolvedValue({
        id: 1002n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        quantityDelta: new Prisma.Decimal('-3'),
        eventType: InventoryEventType.adjustment,
        referenceType: ReferenceType.adjustment,
        occurredAt: new Date(occurredAt),
        notes: 'Damaged units removed',
      });

      const result = await service.postAdjustmentEvent({
        accountId: 1n,
        adjustmentsDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantityDelta: '-3',
          reasonCode: AdjustmentReasonCodes.damage,
          notes: 'Damaged units removed',
          occurredAt,
        },
      });

      expect(txMock.inventoryLedger.create).toHaveBeenCalledWith({
        data: {
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          quantityDelta: new Prisma.Decimal('-3'),
          referenceType: ReferenceType.adjustment,
          externalEventKey: `adjustment:1:11:MAIN:${new Date(occurredAt).toISOString()}:${AdjustmentReasonCodes.damage}`,
          eventType: InventoryEventType.adjustment,
          occurredAt: new Date(occurredAt),
          notes: 'Damaged units removed',
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result.quantityDelta.toString()).toBe('-3');
    });

    it('rejects invalid product id', async () => {
      const promise = service.postAdjustmentEvent({
        accountId: 1n,
        adjustmentsDto: {
          productId: 'abc',
          locationCode: 'MAIN',
          quantityDelta: '5',
          reasonCode: AdjustmentReasonCodes.manual_correction,
          notes: 'Bad product id test',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid productId abc');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects invalid occurredAt', async () => {
      await expect(
        service.postAdjustmentEvent({
          accountId: 1n,
          adjustmentsDto: {
            productId: '11',
            locationCode: 'MAIN',
            quantityDelta: '5',
            reasonCode: AdjustmentReasonCodes.manual_correction,
            notes: 'Bad date test',
            occurredAt: 'not-a-date',
          },
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.postAdjustmentEvent({
          accountId: 1n,
          adjustmentsDto: {
            productId: '11',
            locationCode: 'MAIN',
            quantityDelta: '5',
            reasonCode: AdjustmentReasonCodes.manual_correction,
            notes: 'Bad date test',
            occurredAt: 'not-a-date',
          },
        }),
      ).rejects.toThrow('Invalid occurredAt date not-a-date');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects zero quantityDelta', async () => {
      await expect(
        service.postAdjustmentEvent({
          accountId: 1n,
          adjustmentsDto: {
            productId: '11',
            locationCode: 'MAIN',
            quantityDelta: '0',
            reasonCode: AdjustmentReasonCodes.manual_correction,
            notes: 'Zero delta test',
            occurredAt: '2026-04-18T12:00:00.000Z',
          },
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.postAdjustmentEvent({
          accountId: 1n,
          adjustmentsDto: {
            productId: '11',
            locationCode: 'MAIN',
            quantityDelta: '0',
            reasonCode: AdjustmentReasonCodes.manual_correction,
            notes: 'Zero delta test',
            occurredAt: '2026-04-18T12:00:00.000Z',
          },
        }),
      ).rejects.toThrow('quantityDelta must not be zero.');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });
  });

  describe('postTransferEvent', () => {
    it('creates transfer out/in ledger rows and recalculates both balances', async () => {
      const occurredAt = '2026-04-18T12:00:00.000Z';
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });
      prismaMock.location.findUnique
        .mockResolvedValueOnce({ accountId: 1n, code: 'MAIN', isActive: true })
        .mockResolvedValueOnce({ accountId: 1n, code: 'ORL', isActive: true });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal('5'),
        qtyReserved: new Prisma.Decimal('0'),
        qtyAvailable: new Prisma.Decimal('5'),
      });

      txMock.inventoryLedger.create
        .mockResolvedValueOnce({
          id: 2001n,
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          quantityDelta: new Prisma.Decimal('-5'),
          eventType: InventoryEventType.transfer_out,
        })
        .mockResolvedValueOnce({
          id: 2002n,
          accountId: 1n,
          productId: 11n,
          locationCode: 'ORL',
          quantityDelta: new Prisma.Decimal('5'),
          eventType: InventoryEventType.transfer_in,
        });

      const result = await service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'ORL',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt,
        },
      });

      expect(txMock.inventoryLedger.create).toHaveBeenCalledTimes(2);

      expect(txMock.inventoryLedger.create).toHaveBeenNthCalledWith(1, {
        data: {
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          quantityDelta: new Prisma.Decimal('-5'),
          referenceType: ReferenceType.transfer,
          externalEventKey: `transfer:1:11:MAIN:ORL:${new Date(occurredAt).toISOString()}:out`,
          eventType: InventoryEventType.transfer_out,
          occurredAt: new Date(occurredAt),
          notes: 'Test transfer',
        },
      });

      expect(txMock.inventoryLedger.create).toHaveBeenNthCalledWith(2, {
        data: {
          accountId: 1n,
          productId: 11n,
          locationCode: 'ORL',
          quantityDelta: new Prisma.Decimal('5'),
          referenceType: ReferenceType.transfer,
          externalEventKey: `transfer:1:11:MAIN:ORL:${new Date(occurredAt).toISOString()}:in`,
          eventType: InventoryEventType.transfer_in,
          occurredAt: new Date(occurredAt),
          notes: 'Test transfer',
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenNthCalledWith(1, 1n, 11n, 'MAIN', txMock);

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenNthCalledWith(2, 1n, 11n, 'ORL', txMock);

      expect(result).toEqual({
        productId: '11',
        fromLocationCode: 'MAIN',
        toLocationCode: 'ORL',
        quantity: '5',
        occurredAt: '2026-04-18T12:00:00.000Z',
        transferOutLedgerId: '2001',
        transferInLedgerId: '2002',
      });

      expect(prismaMock.inventoryBalance.findUnique).toHaveBeenCalledWith({
        where: {
          accountId_productId_locationCode: {
            accountId: 1n,
            productId: 11n,
            locationCode: 'MAIN',
          },
        },
      });
    });

    it('rejects same source and destination', async () => {
      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'MAIN',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'fromLocationCode and toLocationCode must be different',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects zero quantity', async () => {
      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'SECONDARY',
          quantity: '0',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:33:33.333Z',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'quantity must be greater than zero.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects negative quantity', async () => {
      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'SECONDARY',
          quantity: '-5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'quantity must be greater than zero.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects missing source location', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });
      prismaMock.location.findUnique
        .mockResolvedValueOnce(null) // source missing
        .mockResolvedValueOnce({
          accountId: 1n,
          code: 'SECONDARY',
          isActive: true,
        });

      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'NONEXISTENT',
          toLocationCode: 'SECONDARY',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        'From location with code NONEXISTENT not found or inactive',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects missing destination location', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });
      prismaMock.location.findUnique
        .mockResolvedValueOnce({ accountId: 1n, code: 'MAIN', isActive: true })
        .mockResolvedValueOnce(null);

      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'NONEXISTENT',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        'To location with code NONEXISTENT not found or inactive',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('rejects inactive source location', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });
      prismaMock.location.findUnique
        .mockResolvedValueOnce({
          accountId: 1n,
          code: 'INACTIVE_SOURCE',
          isActive: false,
        })
        .mockResolvedValueOnce({ accountId: 1n, code: 'MAIN', isActive: true });

      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'INACTIVE_SOURCE',
          toLocationCode: 'MAIN',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(
        'From location with code INACTIVE_SOURCE not found or inactive',
      );
    });

    it('rejects inactive destination location', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });
      prismaMock.location.findUnique
        .mockResolvedValueOnce({ accountId: 1n, code: 'MAIN', isActive: true })
        .mockResolvedValueOnce({
          accountId: 1n,
          code: 'INACTIVE_DESTINATION',
          isActive: false,
        });

      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'INACTIVE_DESTINATION',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(
        'To location with code INACTIVE_DESTINATION not found or inactive',
      );
    });

    it('rejects missing product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'ORL',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Product 11 not found');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects insufficient available quantity at source location', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });

      prismaMock.location.findUnique
        .mockResolvedValueOnce({ accountId: 1n, code: 'MAIN', isActive: true })
        .mockResolvedValueOnce({ accountId: 1n, code: 'ORL', isActive: true });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal('3'),
        qtyReserved: new Prisma.Decimal('0'),
        qtyAvailable: new Prisma.Decimal('3'),
      });

      const promise = service.postTransferEvent({
        accountId: 1n,
        transfersDto: {
          productId: '11',
          fromLocationCode: 'MAIN',
          toLocationCode: 'ORL',
          quantity: '5',
          notes: 'Test transfer',
          occurredAt: '2026-04-18T12:00:00.000Z',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Insufficient available quantity at location MAIN for product 11. Available: 3, requested: 5.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryLedger.create).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getLedger', () => {
    it('constructs correct query filters', async () => {
      const accountId = 1n;
      const query = {
        productId: '11',
        locationCode: 'MAIN',
        eventType: InventoryEventType.adjustment,
        fromOccurredAt: '2026-01-01T00:00:00.000Z',
        toOccurredAt: '2026-12-31T23:59:59.999Z',
        take: 10,
        skip: 5,
      };

      await service.getLedger(accountId, query);

      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            productId: 11n,
            locationCode: 'MAIN',
            eventType: InventoryEventType.adjustment,
            occurredAt: {
              gte: new Date('2026-01-01T00:00:00.000Z'),
              lte: new Date('2026-12-31T23:59:59.999Z'),
            },
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 10,
          skip: 5,
        }),
      );
    });

    it('handles missing optional filters', async () => {
      const accountId = 1n;
      const query = {};

      await service.getLedger(accountId, query);

      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
    });

    it('combines multiple filters correctly', async () => {
      const query = {
        productId: '11',
        locationCode: 'MAIN',
        eventType: InventoryEventType.adjustment,
      };

      await service.getLedger(1n, query);

      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId: 1n,
            productId: 11n,
            locationCode: 'MAIN',
            eventType: InventoryEventType.adjustment,
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
    });

    it('handles invalid date formats', async () => {
      const accountId = 1n;
      const query = {
        fromOccurredAt: 'invalid-date',
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid fromOccurredAt date invalid-date',
      );
    });

    it('handles non-integer take/skip values', async () => {
      const accountId = 1n;
      const query = {
        take: 'not-a-number' as any,
        skip: 'also-not-a-number' as any,
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid take value not-a-number',
      );
    });

    it('handles negative take/skip values', async () => {
      const accountId = 1n;
      const query = {
        take: -5,
        skip: -10,
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid take value -5',
      );
    });

    it('handles zero take value', async () => {
      const accountId = 1n;
      const query = {
        take: 0,
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid take value 0',
      );
    });

    it('handles zero skip value', async () => {
      const accountId = 1n;
      const query = {
        skip: 0,
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid skip value 0',
      );
    });

    it('handles non-integer productId', async () => {
      const accountId = 1n;
      const query = {
        productId: 'not-a-number',
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid productId not-a-number',
      );
    });

    it('handles empty string productId', async () => {
      const accountId = 1n;
      const query = {
        productId: '',
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid productId ',
      );
    });

    it('handles empty string locationCode', async () => {
      const accountId = 1n;
      const query = {
        locationCode: '',
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid locationCode ',
      );
    });

    it('handles invalid eventType', async () => {
      const accountId = 1n;
      const query = {
        eventType: 'not-a-valid-event-type' as InventoryEventType,
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'Invalid eventType not-a-valid-event-type',
      );
    });

    it('handles fromOccurredAt after toOccurredAt', async () => {
      const accountId = 1n;
      const query = {
        fromOccurredAt: '2026-12-31T23:59:59.999Z',
        toOccurredAt: '2026-01-01T00:00:00.000Z',
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'fromOccurredAt must be before toOccurredAt',
      );
    });

    it('handles fromOccurredAt equal to toOccurredAt', async () => {
      const accountId = 1n;
      const query = {
        fromOccurredAt: '2026-01-01T00:00:00.000Z',
        toOccurredAt: '2026-01-01T00:00:00.000Z',
      };

      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLedger(accountId, query)).rejects.toThrow(
        'fromOccurredAt must be before toOccurredAt',
      );
    });

    it('filters by productId only', async () => {
      const accountId = 1n;
      const query = {
        productId: '11',
      };

      await service.getLedger(accountId, query);
      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            productId: 11n,
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
    });

    it('filters by locationCode only', async () => {
      const accountId = 1n;
      const query = {
        locationCode: 'MAIN',
      };

      await service.getLedger(accountId, query);
      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            locationCode: 'MAIN',
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
    });

    it('filters by eventType only', async () => {
      const accountId = 1n;
      const query = {
        eventType: InventoryEventType.adjustment,
      };

      await service.getLedger(accountId, query);
      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            eventType: InventoryEventType.adjustment,
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
    });

    it('filters by occurredAt range only', async () => {
      const accountId = 1n;
      const query = {
        fromOccurredAt: '2026-01-01T00:00:00.000Z',
        toOccurredAt: '2026-12-31T23:59:59.999Z',
      };

      await service.getLedger(accountId, query);
      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            occurredAt: {
              gte: new Date('2026-01-01T00:00:00.000Z'),
              lte: new Date('2026-12-31T23:59:59.999Z'),
            },
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
    });

    it('applies pagination', async () => {
      const accountId = 1n;
      const query = {
        take: 10,
        skip: 20,
      };

      await service.getLedger(accountId, query);
      expect(prismaMock.inventoryLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 10,
          skip: 20,
        }),
      );
    });

    it('adds movementDirection to results', async () => {
      prismaMock.inventoryLedger.findMany.mockResolvedValue([
        {
          id: 1n,
          quantityDelta: new Prisma.Decimal('5'),
          occurredAt: new Date(),
        },
        {
          id: 2n,
          quantityDelta: new Prisma.Decimal('-3'),
          occurredAt: new Date(),
        },
      ]);

      const result = await service.getLedger(1n, {});

      expect(result[0].movementDirection).toBe('inbound');
      expect(result[1].movementDirection).toBe('outbound');
    });
  });

  describe('getBalances', () => {
    it('returns current balance for product and location', async () => {
      const accountId = 1n;
      const productId = 11n;
      const locationCode = 'MAIN';
      const filters = { productId: '11', locationCode: 'MAIN' };

      prismaMock.inventoryBalance.findMany.mockResolvedValue([
        {
          accountId,
          productId,
          locationCode,
          qtyOnHand: new Prisma.Decimal('100'),
          qtyReserved: new Prisma.Decimal('20'),
          qtyIncoming: new Prisma.Decimal('0'),
          qtyAvailable: new Prisma.Decimal('80'),
        },
      ]);

      const result = await service.getBalances(accountId, filters);

      expect(prismaMock.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            productId,
            locationCode,
          },
          take: 100,
          skip: 0,
        }),
      );

      expect(result).toEqual([
        {
          accountId,
          productId,
          locationCode,
          qtyOnHand: new Prisma.Decimal('100'),
          qtyReserved: new Prisma.Decimal('20'),
          qtyIncoming: new Prisma.Decimal('0'),
          qtyAvailable: new Prisma.Decimal('80'),
        },
      ]);
    });

    it('returns null if no balance record exists', async () => {
      const accountId = 1n;
      const productId = '11';
      const locationCode = 'MAIN';

      prismaMock.inventoryBalance.findMany.mockResolvedValue([]);

      const result = await service.getBalances(accountId, {
        productId,
        locationCode,
      });

      expect(prismaMock.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            productId: 11n,
            locationCode,
          },
        }),
      );

      expect(result).toEqual([]);
    });

    it('handles invalid productId', async () => {
      const accountId = 1n;
      const filters = { productId: 'not-a-number', locationCode: 'MAIN' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'Invalid productId not-a-number',
      );
    });

    it('handles empty string productId', async () => {
      const accountId = 1n;
      const filters = { productId: '', locationCode: 'MAIN' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'Invalid productId ',
      );
    });

    it('handles empty string locationCode', async () => {
      const accountId = 1n;
      const filters = { productId: '11', locationCode: '' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'Invalid locationCode ',
      );
    });

    it('handles missing productId', async () => {
      const accountId = 1n;
      const filters = { locationCode: 'MAIN' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'productId is required',
      );
    });

    it('handles missing locationCode', async () => {
      const accountId = 1n;
      const filters = { productId: '11' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'locationCode is required',
      );
    });

    it('filters by productId only', async () => {
      const accountId = 1n;
      const filters = { productId: '11' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'locationCode is required',
      );
    });

    it('filters by locationCode only', async () => {
      const accountId = 1n;
      const filters = { locationCode: 'MAIN' };

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'productId is required',
      );
    });

    it('supports only non-zero quantity balances', async () => {
      const accountId = 1n;
      const productId = 11n;
      const locationCode = 'MAIN';
      const filters = { productId: '11', locationCode: 'MAIN' };

      prismaMock.inventoryBalance.findMany.mockResolvedValue([
        {
          accountId,
          productId,
          locationCode,
          qtyOnHand: new Prisma.Decimal('0'),
          qtyReserved: new Prisma.Decimal('0'),
          qtyIncoming: new Prisma.Decimal('0'),
          qtyAvailable: new Prisma.Decimal('0'),
        },
      ]);

      const result = await service.getBalances(accountId, filters);

      expect(prismaMock.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            productId,
            locationCode,
          },
          take: 100,
          skip: 0,
        }),
      );

      expect(result).toEqual([
        {
          accountId,
          productId,
          locationCode,
          qtyOnHand: new Prisma.Decimal('0'),
          qtyReserved: new Prisma.Decimal('0'),
          qtyIncoming: new Prisma.Decimal('0'),
          qtyAvailable: new Prisma.Decimal('0'),
        },
      ]);
    });

    it('handles database errors gracefully', async () => {
      const accountId = 1n;
      const filters = { productId: '11', locationCode: 'MAIN' };

      prismaMock.inventoryBalance.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getBalances(accountId, filters)).rejects.toThrow(
        'Database error',
      );
    });

    it('supports pagination', async () => {
      const accountId = 1n;
      const filters = {
        productId: '11',
        locationCode: 'MAIN',
        take: 10,
        skip: 20,
      };

      prismaMock.inventoryBalance.findMany.mockResolvedValue([
        {
          accountId,
          productId: 11n,
          locationCode: 'MAIN',
          qtyOnHand: new Prisma.Decimal('100'),
          qtyReserved: new Prisma.Decimal('20'),
          qtyIncoming: new Prisma.Decimal('0'),
          qtyAvailable: new Prisma.Decimal('80'),
        },
      ]);

      const result = await service.getBalances(accountId, filters);

      expect(prismaMock.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId,
            productId: 11n,
            locationCode: 'MAIN',
          },
          take: 10,
          skip: 20,
        }),
      );

      expect(result).toEqual([
        {
          accountId,
          productId: 11n,
          locationCode: 'MAIN',
          qtyOnHand: new Prisma.Decimal('100'),
          qtyReserved: new Prisma.Decimal('20'),
          qtyIncoming: new Prisma.Decimal('0'),
          qtyAvailable: new Prisma.Decimal('80'),
        },
      ]);
    });
  });

  describe('createReservation', () => {
    it('creates an active reservation and recalculates balance', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });

      prismaMock.location.findFirst.mockResolvedValue({
        id: 1n,
        accountId: 1n,
        code: 'MAIN',
        isActive: true,
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal('20'),
        qtyReserved: new Prisma.Decimal('5'),
        qtyAvailable: new Prisma.Decimal('15'),
      });

      txMock.inventoryReservation.create.mockResolvedValue({
        id: 301n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        reservedQty: new Prisma.Decimal('5'),
        sourceType: 'manual',
        sourceId: 9001n,
        status: 'active',
        notes: 'Reservation',
      });

      const result = await service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '5',
          sourceType: 'manual' as any,
          sourceId: '9001',
          notes: 'Reservation',
        },
      });

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: {
          id: 11n,
          accountId: 1n,
        },
        select: { id: true },
      });

      expect(prismaMock.location.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: 1n,
          code: 'MAIN',
          isActive: true,
        },
        select: { id: true, code: true },
      });

      expect(prismaMock.inventoryBalance.findUnique).toHaveBeenCalledWith({
        where: {
          accountId_productId_locationCode: {
            accountId: 1n,
            productId: 11n,
            locationCode: 'MAIN',
          },
        },
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.inventoryReservation.create).toHaveBeenCalledWith({
        data: {
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          reservedQty: new Prisma.Decimal('5'),
          sourceType: 'manual',
          sourceId: 9001n,
          notes: 'Reservation',
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result).toEqual({
        id: 301n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        reservedQty: new Prisma.Decimal('5'),
        sourceType: 'manual',
        sourceId: 9001n,
        status: 'active',
        notes: 'Reservation',
      });
    });

    it('defaults sourceType to manual when omitted', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });

      prismaMock.location.findFirst.mockResolvedValue({
        id: 1n,
        accountId: 1n,
        code: 'MAIN',
        isActive: true,
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        qtyAvailable: new Prisma.Decimal('10'),
      });

      txMock.inventoryReservation.create.mockResolvedValue({
        id: 302n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        reservedQty: new Prisma.Decimal('4'),
        sourceType: 'manual',
        sourceId: 9002n,
        status: 'active',
        notes: 'Reservation',
      });

      await service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '4',
          sourceId: '9002',
        } as any,
      });

      expect(txMock.inventoryReservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceType: 'manual',
        }),
      });
    });

    it('rejects invalid reservation quantity', async () => {
      const promise = service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: 'abc',
          sourceType: 'manual' as any,
          sourceId: '9001',
          notes: 'Reservation',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid quantity abc');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryReservation.create).not.toHaveBeenCalled();
    });

    it('rejects zero reservation quantity', async () => {
      const promise = service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '0',
          sourceType: 'manual' as any,
          sourceId: '9001',
          notes: 'Reservation',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'quantity must be greater than zero.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryReservation.create).not.toHaveBeenCalled();
    });

    it('rejects insufficient available quantity', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });

      prismaMock.location.findFirst.mockResolvedValue({
        id: 1n,
        accountId: 1n,
        code: 'MAIN',
        isActive: true,
      });

      prismaMock.inventoryBalance.findUnique.mockResolvedValue({
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        qtyOnHand: new Prisma.Decimal('5'),
        qtyReserved: new Prisma.Decimal('2'),
        qtyAvailable: new Prisma.Decimal('3'),
      });

      const promise = service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '5',
          sourceType: 'manual' as any,
          sourceId: '9001',
          notes: 'Reservation',
        },
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Insufficient available quantity at location MAIN for product 11. Available: 3, requested: 5.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryReservation.create).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });

    it('rejects missing product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const promise = service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '5',
          sourceType: 'manual' as any,
          sourceId: '9001',
          notes: 'Reservation',
        },
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Product 11 not found');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects missing or inactive location', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 11n });
      prismaMock.location.findFirst.mockResolvedValue(null);

      const promise = service.createReservation({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '5',
          sourceType: 'manual' as any,
          sourceId: '9001',
          notes: 'Reservation',
        },
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        'Location with code MAIN not found or inactive',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getReservations', () => {
    it('returns reservations filtered by product and location', async () => {
      prismaMock.inventoryReservation.findMany.mockResolvedValue([
        {
          id: 301n,
          productId: 331n,
          locationCode: 'MAIN',
          sourceType: ReservationSourceType.manual,
          sourceId: 9001n,
          reservedQty: new Prisma.Decimal('5'),
          status: ReservationStatus.active,
          createdAt: new Date('2026-04-22T12:00:00.000Z'),
          updatedAt: new Date('2026-04-22T12:00:00.000Z'),
          releasedAt: null,
          consumedAt: null,
          notes: 'Reservation',
          product: {
            id: 331n,
            sku: 'WB-100',
            name: 'Widget Basic',
          },
        },
      ]);

      const result = await service.getReservations(1n, {
        productId: '331',
        locationCode: 'MAIN',
        take: 50,
      });

      expect(prismaMock.inventoryReservation.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 1n,
          productId: 331n,
          locationCode: 'MAIN',
        },
        select: {
          id: true,
          productId: true,
          locationCode: true,
          sourceType: true,
          sourceId: true,
          reservedQty: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          releasedAt: true,
          consumedAt: true,
          notes: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        skip: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe(331n);
      expect(result[0].locationCode).toBe('MAIN');
    });

    it('rejects invalid productId', async () => {
      await expect(
        service.getReservations(1n, {
          productId: 'abc',
        }),
      ).rejects.toThrow('Invalid productId abc');

      expect(prismaMock.inventoryReservation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('releaseReservation', () => {
    it('releases active reservation and recalculates balance', async () => {
      txMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 101n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        status: 'active',
      });

      txMock.inventoryReservation.update.mockResolvedValue({
        id: 101n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        status: 'released',
        releasedAt: new Date(),
      });

      const result = await service.releaseReservation({
        accountId: 1n,
        reservationId: '101',
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.inventoryReservation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 101n,
          accountId: 1n,
        },
        select: {
          id: true,
          accountId: true,
          productId: true,
          locationCode: true,
          status: true,
        },
      });

      expect(txMock.inventoryReservation.update).toHaveBeenCalledWith({
        where: {
          id: 101n,
        },
        data: {
          status: 'released',
          releasedAt: expect.any(Date),
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result).toEqual(
        expect.objectContaining({
          id: 101n,
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          status: 'released',
        }),
      );
    });

    it('rejects invalid reservationId', async () => {
      const promise = service.releaseReservation({
        accountId: 1n,
        reservationId: 'abc',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid reservationId abc');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryReservation.findFirst).not.toHaveBeenCalled();
    });

    it('rejects missing reservation', async () => {
      txMock.inventoryReservation.findFirst.mockResolvedValue(null);

      const promise = service.releaseReservation({
        accountId: 1n,
        reservationId: '101',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Reservation 101 not found');

      expect(txMock.inventoryReservation.update).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });

    it('rejects non-active reservation', async () => {
      txMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 101n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        status: 'released',
      });

      const promise = service.releaseReservation({
        accountId: 1n,
        reservationId: '101',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Only active reservations can be released.',
      );

      expect(txMock.inventoryReservation.update).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });
  });

  describe('consumeReservation', () => {
    it('consumes active reservation and recalculates balance', async () => {
      txMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 201n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        status: 'active',
      });

      txMock.inventoryReservation.update.mockResolvedValue({
        id: 201n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        status: 'consumed',
        consumedAt: new Date(),
      });

      const result = await service.consumeReservation({
        accountId: 1n,
        reservationId: '201',
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.inventoryReservation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 201n,
          accountId: 1n,
        },
        select: {
          id: true,
          accountId: true,
          productId: true,
          locationCode: true,
          status: true,
        },
      });

      expect(txMock.inventoryReservation.update).toHaveBeenCalledWith({
        where: {
          id: 201n,
        },
        data: {
          status: 'consumed',
          consumedAt: expect.any(Date),
        },
      });

      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).toHaveBeenCalledWith(1n, 11n, 'MAIN', txMock);

      expect(result).toEqual(
        expect.objectContaining({
          id: 201n,
          accountId: 1n,
          productId: 11n,
          locationCode: 'MAIN',
          status: 'consumed',
        }),
      );
    });

    it('rejects invalid reservationId', async () => {
      const promise = service.consumeReservation({
        accountId: 1n,
        reservationId: 'abc',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid reservationId abc');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.inventoryReservation.findFirst).not.toHaveBeenCalled();
    });

    it('rejects missing reservation', async () => {
      txMock.inventoryReservation.findFirst.mockResolvedValue(null);

      const promise = service.consumeReservation({
        accountId: 1n,
        reservationId: '201',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Reservation 201 not found');

      expect(txMock.inventoryReservation.update).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });

    it('rejects non-active reservation', async () => {
      txMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 201n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        status: 'consumed',
      });

      const promise = service.consumeReservation({
        accountId: 1n,
        reservationId: '201',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Only active reservations can be consumed.',
      );

      expect(txMock.inventoryReservation.update).not.toHaveBeenCalled();
      expect(
        inventoryBalanceServiceMock.recalculateInventoryBalanceForProduct,
      ).not.toHaveBeenCalled();
    });
  });

  describe('reserveOrderLineInventory', () => {
    it('creates a reservation for an order line', async () => {
      jest.spyOn(service, 'createReservation').mockResolvedValue({
        id: 701n,
        accountId: 1n,
        productId: 11n,
        locationCode: 'MAIN',
        reservedQty: new Prisma.Decimal('3'),
        sourceType: 'sales_order_line',
        sourceId: 5001n,
        status: 'active',
        notes: 'Reserved for order line 5001',
      } as any);

      prismaMock.orderLine.findFirst.mockResolvedValue({
        id: 5001n,
        accountId: 1n,
        orderId: 4001n,
        productId: 11n,
        quantity: new Prisma.Decimal('3'),
        locationCode: 'MAIN',
      });

      prismaMock.inventoryReservation.findFirst.mockResolvedValue(null);

      const result = await service.reserveOrderLineInventory({
        accountId: 1n,
        orderLineId: '5001',
      });

      expect(prismaMock.orderLine.findFirst).toHaveBeenCalledWith({
        where: {
          id: 5001n,
          accountId: 1n,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          orderId: true,
        },
      });

      expect(prismaMock.inventoryReservation.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: 1n,
          sourceType: 'sales_order_line',
          sourceId: 5001n,
          status: 'active',
        },
        select: { id: true },
      });

      expect(service.createReservation).toHaveBeenCalledWith({
        accountId: 1n,
        createReservationDto: {
          productId: '11',
          locationCode: 'MAIN',
          quantity: '3',
          sourceType: 'sales_order_line',
          sourceId: '5001',
          notes: 'Reserved for order line 5001',
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 701n,
          status: 'active',
        }),
      );
    });

    it('rejects invalid orderLineId', async () => {
      const promise = service.reserveOrderLineInventory({
        accountId: 1n,
        orderLineId: 'abc',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid orderLineId abc');

      expect(prismaMock.orderLine.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.inventoryReservation.findFirst).not.toHaveBeenCalled();
    });

    it('rejects missing order line', async () => {
      prismaMock.orderLine.findFirst.mockResolvedValue(null);

      const promise = service.reserveOrderLineInventory({
        accountId: 1n,
        orderLineId: '5001',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Order line 5001 not found');

      expect(prismaMock.inventoryReservation.findFirst).not.toHaveBeenCalled();
    });

    it('rejects duplicate active reservation for order line', async () => {
      const createReservationSpy = jest.spyOn(service, 'createReservation');

      prismaMock.orderLine.findFirst.mockResolvedValue({
        id: 5001n,
        accountId: 1n,
        orderId: 4001n,
        productId: 11n,
        quantity: new Prisma.Decimal('3'),
        locationCode: 'MAIN',
      });

      prismaMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 801n,
      });

      const promise = service.reserveOrderLineInventory({
        accountId: 1n,
        orderLineId: '5001',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Active reservation already exists for order line 5001.',
      );

      expect(createReservationSpy).not.toHaveBeenCalled();
    });
  });

  describe('releaseOrderLineReservation', () => {
    it('releases active reservation for an order line', async () => {
      jest.spyOn(service, 'releaseReservation').mockResolvedValue({
        id: 901n,
        status: 'released',
      } as any);

      prismaMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 901n,
      });

      const result = await service.releaseOrderLineReservation({
        accountId: 1n,
        orderLineId: '5001',
      });

      expect(prismaMock.inventoryReservation.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: 1n,
          sourceType: 'sales_order_line',
          sourceId: 5001n,
          status: 'active',
        },
        select: { id: true },
      });

      expect(service.releaseReservation).toHaveBeenCalledWith({
        accountId: 1n,
        reservationId: '901',
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 901n,
          status: 'released',
        }),
      );
    });

    it('rejects invalid orderLineId', async () => {
      const promise = service.releaseOrderLineReservation({
        accountId: 1n,
        orderLineId: 'abc',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid orderLineId abc');

      expect(prismaMock.inventoryReservation.findFirst).not.toHaveBeenCalled();
    });

    it('rejects missing active reservation for order line', async () => {
      const releaseReservationSpy = jest.spyOn(service, 'releaseReservation');

      prismaMock.inventoryReservation.findFirst.mockResolvedValue(null);

      const promise = service.releaseOrderLineReservation({
        accountId: 1n,
        orderLineId: '5001',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        'Active reservation for order line 5001 not found',
      );

      expect(releaseReservationSpy).not.toHaveBeenCalled();
    });
  });

  describe('consumeOrderLineReservation', () => {
    it('consumes active reservation for an order line', async () => {
      jest.spyOn(service, 'consumeReservation').mockResolvedValue({
        id: 1001n,
        status: 'consumed',
      } as any);

      prismaMock.inventoryReservation.findFirst.mockResolvedValue({
        id: 1001n,
      });

      const result = await service.consumeOrderLineReservation({
        accountId: 1n,
        orderLineId: '5001',
      });

      expect(prismaMock.inventoryReservation.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: 1n,
          sourceType: 'sales_order_line',
          sourceId: 5001n,
          status: 'active',
        },
        select: { id: true },
      });

      expect(service.consumeReservation).toHaveBeenCalledWith({
        accountId: 1n,
        reservationId: '1001',
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 1001n,
          status: 'consumed',
        }),
      );
    });

    it('rejects invalid orderLineId', async () => {
      const promise = service.consumeOrderLineReservation({
        accountId: 1n,
        orderLineId: 'abc',
      });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid orderLineId abc');

      expect(prismaMock.inventoryReservation.findFirst).not.toHaveBeenCalled();
    });

    it('rejects missing active reservation for order line', async () => {
      const consumeReservationSpy = jest.spyOn(service, 'consumeReservation');

      prismaMock.inventoryReservation.findFirst.mockResolvedValue(null);

      const promise = service.consumeOrderLineReservation({
        accountId: 1n,
        orderLineId: '5001',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        'Active reservation for order line 5001 not found',
      );

      expect(consumeReservationSpy).not.toHaveBeenCalled();
    });
  });
});
