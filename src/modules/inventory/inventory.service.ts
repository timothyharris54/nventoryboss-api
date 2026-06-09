import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryBalanceService } from './services/inventory-balance.service';
import {
  Prisma,
  ReferenceType,
  InventoryEventType,
  ReservationStatus,
  ReservationSourceType,
} from '@prisma/client';
import { OpeningBalanceDto } from './dto/opening-balance.dto';
import { AdjustmentsDto } from 'src/modules/inventory/dto/adjustments.dto';
import { TransfersDto } from 'src/modules/inventory/dto/transfers.dto';
import { GetLedgerQueryDto } from 'src/modules/inventory/dto/get-ledger-query.dto';
import { getMovementDirection } from 'src/modules/inventory/utils/inventory.utils';
import { GetBalanceQueryDto } from 'src/modules/inventory/dto/get-balance-query.dto';
import { CreateReservationDto } from 'src/modules/inventory/dto/create-reservation.dto';
import { GetReservationsQueryDto } from 'src/modules/inventory/dto/get-reservations-query.dto';

type InventoryInput = {
  accountId: bigint;
  openingBalanceDto: OpeningBalanceDto;
};
type AdjustmentInput = {
  accountId: bigint;
  adjustmentsDto: AdjustmentsDto;
};
type TransferInput = {
  accountId: bigint;
  transfersDto: TransfersDto;
};
type ReservationInput = {
  accountId: bigint;
  createReservationDto: CreateReservationDto;
};

const INVENTORY_LEDGER_EVENT_TYPES = new Set<InventoryEventType>(
  Object.values(InventoryEventType),
);
const INVENTORY_RESERVATION_STATUSES = new Set<ReservationStatus>(
  Object.values(ReservationStatus),
);
const INVENTORY_RESERVATION_SOURCE_TYPES = new Set<ReservationSourceType>(
  Object.values(ReservationSourceType),
);

@Injectable()
export class InventoryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryBalanceService: InventoryBalanceService,
  ) {}

  async postOpeningBalance(input: InventoryInput) {
    const accountId = input.accountId;
    const openingBalanceDto = input.openingBalanceDto;
    const productId = BigInt(openingBalanceDto.productId);
    const quantity = new Prisma.Decimal(openingBalanceDto.quantity);

    const product = await this.prismaService.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
    return this.prismaService.$transaction(async (tx) => {
      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId: productId,
          locationCode: openingBalanceDto.locationCode,
          eventType: InventoryEventType.opening_balance,
          quantityDelta: quantity,
          referenceType: 'system',
          externalEventKey: `opening_balance:${accountId}:${productId}:${openingBalanceDto.locationCode}`,
          occurredAt: new Date(),
          notes: openingBalanceDto.notes,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        productId,
        openingBalanceDto.locationCode,
        tx,
      );

      return ledgerEntry;
    });
  }

  async postSaleEvent(
    accountId: bigint,
    orderLineId: bigint,
    locationCode = 'MAIN',
  ) {
    const orderLine = await this.prismaService.orderLine.findUnique({
      where: {
        id: orderLineId,
        accountId,
      },
      include: { order: true, product: true },
    });
    if (!orderLine || !orderLine.productId) {
      throw new NotFoundException(
        `Order line with ID ${orderLineId} not found`,
      );
    }

    const externalEventKey = `${accountId}:${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.id}:sale`;

    const existingEntry = await this.prismaService.inventoryLedger.findUnique({
      where: {
        accountId_externalEventKey: {
          accountId,
          externalEventKey: externalEventKey,
        },
      },
    });
    if (existingEntry) {
      return existingEntry;
      // throw new NotFoundException(`Sale event for order line ${orderLineId} already exists`);
    }

    return this.prismaService.$transaction(async (tx) => {
      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId: orderLine.productId!,
          locationCode,
          eventType: 'sale',
          quantityDelta: new Prisma.Decimal(orderLine.quantity.neg()),
          referenceType: 'order',
          externalEventKey,
          occurredAt: orderLine.order.orderedAt,
          notes: `Sale for order ${orderLine.order.channelOrderId}`,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        orderLine.productId!,
        locationCode,
        tx,
      );

      return ledgerEntry;
    });
  }

  async postExternalChannelSaleEvent(input: {
    accountId: bigint;
    orderLineId: bigint;
    locationCode?: string;
  }) {
    const locationCode = input.locationCode ?? 'MAIN';
    const orderLine = await this.prismaService.orderLine.findUnique({
      where: {
        id: input.orderLineId,
        accountId: input.accountId,
      },
      include: { order: true, product: true },
    });

    if (!orderLine || !orderLine.productId) {
      throw new NotFoundException(
        `Order line with ID ${input.orderLineId} not found`,
      );
    }

    if (!orderLine.channelLineId) {
      throw new BadRequestException(
        `Order line ${input.orderLineId} does not have an external channel line id`,
      );
    }

    const externalEventKey = `${input.accountId}:${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.channelLineId}:sale`;

    const existingEntry = await this.prismaService.inventoryLedger.findUnique({
      where: {
        accountId_externalEventKey: {
          accountId: input.accountId,
          externalEventKey,
        },
      },
    });
    if (existingEntry) {
      return {
        action: 'existing' as const,
        ledgerEntry: existingEntry,
      };
    }

    const ledgerEntry = await this.prismaService.$transaction(async (tx) => {
      const createdEntry = await tx.inventoryLedger.create({
        data: {
          accountId: input.accountId,
          productId: orderLine.productId!,
          locationCode,
          eventType: InventoryEventType.sale,
          quantityDelta: new Prisma.Decimal(orderLine.quantity.neg()),
          referenceType: ReferenceType.order,
          referenceId: orderLine.orderId,
          externalEventKey,
          occurredAt: orderLine.order.orderedAt,
          notes: `Sale for ${orderLine.order.channel} order ${orderLine.order.channelOrderId}`,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        input.accountId,
        orderLine.productId!,
        locationCode,
        tx,
      );

      return createdEntry;
    });

    return {
      action: 'created' as const,
      ledgerEntry,
    };
  }

  async postSaleReversal(
    accountId: bigint,
    orderLineId: bigint,
    locationCode = 'MAIN',
  ) {
    const orderLine = await this.prismaService.orderLine.findUnique({
      where: {
        id: orderLineId,
        accountId,
      },
      include: { order: true, product: true },
    });
    if (!orderLine || !orderLine.productId) {
      throw new NotFoundException(
        `Order line with ID ${orderLineId} not found`,
      );
    }

    const externalEventKey = `${accountId}:${orderLine.order.channel}:order:${orderLine.order.channelOrderId}:line:${orderLine.id}:sale_reversal`;

    const existingEntry = await this.prismaService.inventoryLedger.findUnique({
      where: {
        accountId_externalEventKey: {
          accountId,
          externalEventKey: externalEventKey,
        },
      },
    });
    if (existingEntry) {
      console.log(
        'Existing ledger entry found for sale reversal:',
        existingEntry,
      );
      return existingEntry;
    }

    return this.prismaService.$transaction(async (tx) => {
      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId: orderLine.productId!,
          locationCode,
          eventType: 'sale_reversal',
          quantityDelta: new Prisma.Decimal(orderLine.quantity),
          referenceType: 'order',
          referenceId: orderLine.orderId,
          externalEventKey,
          occurredAt: new Date(),
          notes: `Sale reversal for order ${orderLine.order.channelOrderId}`,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        orderLine.productId!,
        locationCode,
        tx,
      );

      return ledgerEntry;
    });
  }

  async postReceiptEvent(
    accountId: bigint,
    productId: bigint,
    locationCode: string,
    quantity: Prisma.Decimal,
    receiptId: bigint,
    notes?: string,
    unitCost?: Prisma.Decimal,
  ) {
    const externalEventKey = `${accountId}:receipt:${receiptId}`;

    const existingEntry = await this.prismaService.inventoryLedger.findUnique({
      where: {
        accountId_externalEventKey: {
          accountId,
          externalEventKey,
        },
      },
    });
    if (existingEntry) {
      return existingEntry;
      // throw new NotFoundException(`Receipt event for receipt ${receiptId} already exists`);
    }
    return this.prismaService.$transaction(async (tx) => {
      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId,
          locationCode,
          eventType: 'receipt',
          quantityDelta: new Prisma.Decimal(quantity),
          unitCost: unitCost || new Prisma.Decimal(0),
          referenceType: 'receipt',
          referenceId: receiptId,
          externalEventKey,
          occurredAt: new Date(),
          notes: notes || `Receipt for order ${receiptId}`,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        productId,
        locationCode,
        tx,
      );

      return ledgerEntry;
    });
  }

  async postAdjustmentEvent(input: AdjustmentInput) {
    const { accountId, adjustmentsDto } = input;
    const {
      productId,
      locationCode,
      quantityDelta,
      reasonCode,
      notes,
      occurredAt,
    } = adjustmentsDto;
    let iProductId: bigint;
    if (productId !== undefined) {
      iProductId = this.parseBigIntField(productId, 'productId');
    }

    const occurred = new Date(occurredAt);
    if (isNaN(occurred.getTime())) {
      throw new BadRequestException(`Invalid occurredAt date ${occurredAt}`);
    }

    const delta = new Prisma.Decimal(quantityDelta);
    if (delta.isZero()) {
      throw new BadRequestException('quantityDelta must not be zero.');
    }

    return this.prismaService.$transaction(async (tx) => {
      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId: iProductId,
          locationCode,
          quantityDelta: delta,
          referenceType: ReferenceType.adjustment,
          externalEventKey: `adjustment:${accountId}:${iProductId}:${locationCode}:${occurred.toISOString()}:${reasonCode}`,
          eventType: InventoryEventType.adjustment,
          occurredAt: occurred,
          notes:
            notes?.trim() ||
            `Inventory adjustment for product ${productId} at location ${locationCode} with reason ${reasonCode}`,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        iProductId,
        locationCode,
        tx,
      );

      return ledgerEntry;
    });
  }

  async postTransferEvent(input: TransferInput) {
    const { accountId, transfersDto } = input;
    const {
      productId,
      fromLocationCode,
      toLocationCode,
      quantity,
      notes,
      occurredAt,
    } = transfersDto;

    let iProductId: bigint;
    try {
      iProductId = BigInt(productId);
    } catch {
      throw new BadRequestException('Invalid product id');
    }

    const fromCode = fromLocationCode?.trim();
    const toCode = toLocationCode?.trim();

    if (!fromCode) {
      throw new BadRequestException('fromLocationCode must be provided');
    }

    if (!toCode) {
      throw new BadRequestException('toLocationCode must be provided');
    }

    if (fromCode === toCode) {
      throw new BadRequestException(
        'fromLocationCode and toLocationCode must be different',
      );
    }

    const occurred = new Date(occurredAt);
    if (isNaN(occurred.getTime())) {
      throw new BadRequestException(`Invalid occurredAt date ${occurredAt}`);
    }

    const delta = new Prisma.Decimal(quantity);
    if (delta.lte(0)) {
      throw new BadRequestException('quantity must be greater than zero.');
    }

    const [product, fromLoc, toLoc] = await Promise.all([
      this.prismaService.product.findFirst({
        where: {
          id: iProductId,
          accountId,
        },
        select: { id: true },
      }),
      this.prismaService.location.findUnique({
        where: {
          accountId_code: {
            accountId,
            code: fromCode,
          },
        },
      }),
      this.prismaService.location.findUnique({
        where: {
          accountId_code: {
            accountId,
            code: toCode,
          },
        },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (!fromLoc || !fromLoc.isActive) {
      throw new NotFoundException(
        `From location with code ${fromCode} not found or inactive`,
      );
    }

    if (!toLoc || !toLoc.isActive) {
      throw new NotFoundException(
        `To location with code ${toCode} not found or inactive`,
      );
    }

    const sourceBalance = await this.prismaService.inventoryBalance.findUnique({
      where: {
        accountId_productId_locationCode: {
          accountId,
          productId: iProductId,
          locationCode: fromCode,
        },
      },
    });
    const qtyAvailable = new Prisma.Decimal(sourceBalance?.qtyAvailable ?? 0);

    if (qtyAvailable.lt(delta)) {
      throw new BadRequestException(
        `Insufficient available quantity at location ${fromCode} for product ${productId}. Available: ${qtyAvailable.toString()}, requested: ${delta.toString()}.`,
      );
    }
    const outQty = delta.neg();

    return this.prismaService.$transaction(async (tx) => {
      const ledgerEntryOut = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId: iProductId,
          locationCode: fromCode,
          quantityDelta: outQty,
          referenceType: ReferenceType.transfer,
          externalEventKey: `transfer:${accountId}:${iProductId}:${fromCode}:${toCode}:${occurred.toISOString()}:out`,
          eventType: InventoryEventType.transfer_out,
          occurredAt: occurred,
          notes:
            notes?.trim() ||
            `Inventory transfer out for product ${productId} from ${fromCode} to ${toCode}`,
        },
      });

      const ledgerEntryIn = await tx.inventoryLedger.create({
        data: {
          accountId,
          productId: iProductId,
          locationCode: toCode,
          quantityDelta: delta,
          referenceType: ReferenceType.transfer,
          externalEventKey: `transfer:${accountId}:${iProductId}:${fromCode}:${toCode}:${occurred.toISOString()}:in`,
          eventType: InventoryEventType.transfer_in,
          occurredAt: occurred,
          notes:
            notes?.trim() ||
            `Inventory transfer in for product ${productId} from ${fromCode} to ${toCode}`,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        iProductId,
        fromCode,
        tx,
      );

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        iProductId,
        toCode,
        tx,
      );

      return {
        productId: iProductId.toString(),
        fromLocationCode: fromCode,
        toLocationCode: toCode,
        quantity: delta.toString(),
        occurredAt: occurred.toISOString(),
        transferOutLedgerId: ledgerEntryOut.id.toString(),
        transferInLedgerId: ledgerEntryIn.id.toString(),
      };
    });
  }

  async getBalances(accountId: bigint, filters?: GetBalanceQueryDto) {
    const productId = this.parseRequiredBigInt(filters?.productId, 'productId');
    const locationCode = this.parseRequiredLocationCode(
      filters?.locationCode,
      'locationCode',
    );
    const take = this.parseOptionalPositiveInteger(filters?.take, 'take');
    const skip = this.parseOptionalPositiveInteger(filters?.skip, 'skip');
    const where: any = { accountId };

    where.productId = productId;
    where.locationCode = locationCode;

    if (filters?.onlyNonZero) {
      where.OR = [
        { qtyOnHand: { not: 0 } },
        { qtyReserved: { not: 0 } },
        { qtyIncoming: { not: 0 } },
      ];
    }

    return this.prismaService.inventoryBalance.findMany({
      where,
      select: {
        productId: true,
        locationCode: true,
        qtyOnHand: true,
        qtyReserved: true,
        qtyIncoming: true,
        qtyAvailable: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: [{ locationCode: 'asc' }, { product: { name: 'asc' } }],
      take: take ?? 100,
      skip: skip ?? 0,
    });
  }

  async getLedger(accountId: bigint, query: GetLedgerQueryDto) {
    const where: any = { accountId };
    const take = this.parseOptionalPositiveInteger(query.take, 'take');
    const skip = this.parseOptionalPositiveInteger(query.skip, 'skip');
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (query.productId !== undefined) {
      where.productId = this.parseBigIntField(query.productId, 'productId');
    }
    if (query.locationCode !== undefined) {
      where.locationCode = this.parseLocationCode(
        query.locationCode,
        'locationCode',
      );
    }
    if (query.eventType) {
      if (!INVENTORY_LEDGER_EVENT_TYPES.has(query.eventType)) {
        throw new BadRequestException(`Invalid eventType ${query.eventType}`);
      }
      where.eventType = query.eventType;
    }
    if (query.fromOccurredAt || query.toOccurredAt) {
      where.occurredAt = {};
      if (query.fromOccurredAt) {
        fromDate = new Date(query.fromOccurredAt);
        if (isNaN(fromDate.getTime())) {
          throw new BadRequestException(
            `Invalid fromOccurredAt date ${query.fromOccurredAt}`,
          );
        }
        where.occurredAt.gte = fromDate;
      }
      if (query.toOccurredAt) {
        toDate = new Date(query.toOccurredAt);
        if (isNaN(toDate.getTime())) {
          throw new BadRequestException(
            `Invalid toOccurredAt date ${query.toOccurredAt}`,
          );
        }
        where.occurredAt.lte = toDate;
      }
      if (fromDate && toDate && fromDate >= toDate) {
        throw new BadRequestException(
          'fromOccurredAt must be before toOccurredAt',
        );
      }
      if (typeof query.take === 'number' && query.take > 0) {
        query.take = Math.min(query.take, 100);
      }

      if (typeof query.skip === 'number' && query.skip > 0) {
        query.skip = Math.min(query.skip, 0);
      }
    }

    const ledgerEntries = await this.prismaService.inventoryLedger.findMany({
      where,
      select: {
        id: true,
        productId: true,
        locationCode: true,
        eventType: true,
        quantityDelta: true,
        unitCost: true,
        referenceType: true,
        referenceId: true,
        externalEventKey: true,
        occurredAt: true,
        notes: true,
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: take ?? 100,
      skip: skip ?? 0,
    });

    return ledgerEntries.map((entry) => ({
      ...entry,
      movementDirection: getMovementDirection(entry.quantityDelta),
    }));
  }

  async getReservations(accountId: bigint, query: GetReservationsQueryDto) {
    const where: any = { accountId };
    const take = this.parseOptionalPositiveInteger(query.take, 'take');
    const skip = this.parseOptionalPositiveInteger(query.skip, 'skip');

    if (query.productId !== undefined) {
      where.productId = this.parseBigIntField(query.productId, 'productId');
    }

    if (query.locationCode !== undefined) {
      where.locationCode = this.parseLocationCode(
        query.locationCode,
        'locationCode',
      );
    }

    if (query.status) {
      if (!INVENTORY_RESERVATION_STATUSES.has(query.status)) {
        throw new BadRequestException(`Invalid status ${query.status}`);
      }
      where.status = query.status;
    }

    if (query.sourceType) {
      if (!INVENTORY_RESERVATION_SOURCE_TYPES.has(query.sourceType)) {
        throw new BadRequestException(`Invalid sourceType ${query.sourceType}`);
      }
      where.sourceType = query.sourceType;
    }

    if (query.sourceId !== undefined) {
      where.sourceId = this.parseBigIntField(query.sourceId, 'sourceId');
    }

    return this.prismaService.inventoryReservation.findMany({
      where,
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
      take: take ?? 100,
      skip: skip ?? 0,
    });
  }

  async createReservation(input: ReservationInput) {
    const { accountId, createReservationDto } = input;
    const { productId, locationCode, quantity, sourceType, sourceId, notes } =
      createReservationDto;

    const iProductId = this.parseBigIntField(productId!, 'productId');
    const srcId = this.parseBigIntField(sourceId!, 'sourceId');
    const locCode = this.parseLocationCode(locationCode!, 'locationCode');
    const reservedQty = this.parseRequiredPositiveDecimal(quantity, 'quantity');
    if (reservedQty.lte(0)) {
      throw new BadRequestException(
        'Reservation quantity must be greater than zero.',
      );
    }

    const [product, location, balance] = await Promise.all([
      this.prismaService.product.findFirst({
        where: {
          id: iProductId,
          accountId,
        },
        select: { id: true },
      }),
      this.prismaService.location.findFirst({
        where: {
          accountId,
          code: locCode,
          isActive: true,
        },
        select: { id: true, code: true },
      }),
      this.prismaService.inventoryBalance.findUnique({
        where: {
          accountId_productId_locationCode: {
            accountId,
            productId: iProductId,
            locationCode: locCode,
          },
        },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (!location) {
      throw new NotFoundException(
        `Location with code ${locCode} not found or inactive`,
      );
    }

    const qtyAvailable = new Prisma.Decimal(balance?.qtyAvailable ?? 0);
    if (qtyAvailable.lt(reservedQty)) {
      throw new BadRequestException(
        `Insufficient available quantity at location ${locCode} for product ${productId}. Available: ${qtyAvailable.toString()}, requested: ${reservedQty.toString()}.`,
      );
    }

    return this.prismaService.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.create({
        data: {
          accountId,
          productId: iProductId,
          locationCode: locCode,
          reservedQty,
          sourceType: sourceType ?? ReservationSourceType.manual,
          sourceId: srcId,
          notes: notes?.trim() || 'Reservation',
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        iProductId,
        locCode,
        tx,
      );

      return reservation;
    });
  }

  async releaseReservation(input: {
    accountId: bigint;
    reservationId: string;
  }) {
    const { accountId, reservationId } = input;

    const iReservationId = this.parseRequiredBigInt(
      reservationId,
      'reservationId',
    );

    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.inventoryReservation.findFirst({
        where: {
          id: iReservationId,
          accountId,
        },
        select: {
          id: true,
          accountId: true,
          productId: true,
          locationCode: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (existing.status !== ReservationStatus.active) {
        throw new BadRequestException(
          'Only active reservations can be released.',
        );
      }

      const releasedAt = new Date();

      const reservation = await tx.inventoryReservation.update({
        where: {
          id: existing.id,
        },
        data: {
          status: ReservationStatus.released,
          releasedAt,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        existing.productId,
        existing.locationCode,
        tx,
      );

      return reservation;
    });
  }

  async reserveOrderLineInventory(input: {
    accountId: bigint;
    orderLineId: string;
  }) {
    const { accountId, orderLineId } = input;
    const iOrderLineId = this.parseRequiredBigInt(orderLineId, 'orderLineId');

    const orderLine = await this.prismaService.orderLine.findFirst({
      where: {
        id: iOrderLineId,
        accountId,
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        orderId: true,
      },
    });

    if (!orderLine) {
      throw new NotFoundException(`Order line ${orderLineId} not found`);
    }

    const existing = await this.prismaService.inventoryReservation.findFirst({
      where: {
        accountId,
        sourceType: ReservationSourceType.sales_order_line,
        sourceId: orderLine.id,
        status: ReservationStatus.active,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Active reservation already exists for order line ${orderLineId}.`,
      );
    }

    return this.createReservation({
      accountId,
      createReservationDto: {
        productId: orderLine.productId!.toString(),
        locationCode: 'MAIN',
        quantity: orderLine.quantity.toString(),
        sourceType: ReservationSourceType.sales_order_line,
        sourceId: orderLine.id.toString(),
        notes: `Reserved for order line ${orderLine.id.toString()}`,
      },
    });
  }

  async releaseOrderLineReservation(input: {
    accountId: bigint;
    orderLineId: string;
  }) {
    const { accountId, orderLineId } = input;
    const iOrderLineId = this.parseRequiredBigInt(orderLineId, 'orderLineId');

    const reservation = await this.prismaService.inventoryReservation.findFirst(
      {
        where: {
          accountId,
          sourceType: ReservationSourceType.sales_order_line,
          sourceId: iOrderLineId,
          status: ReservationStatus.active,
        },
        select: { id: true },
      },
    );

    if (!reservation) {
      throw new NotFoundException(
        `Active reservation for order line ${orderLineId} not found`,
      );
    }

    return this.releaseReservation({
      accountId,
      reservationId: reservation.id.toString(),
    });
  }

  async consumeReservation(input: {
    accountId: bigint;
    reservationId: string;
  }) {
    const { accountId, reservationId } = input;

    const iReservationId = this.parseRequiredBigInt(
      reservationId,
      'reservationId',
    );

    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.inventoryReservation.findFirst({
        where: {
          id: iReservationId,
          accountId,
        },
        select: {
          id: true,
          accountId: true,
          productId: true,
          locationCode: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (existing.status !== ReservationStatus.active) {
        throw new BadRequestException(
          'Only active reservations can be consumed.',
        );
      }

      const consumedAt = new Date();

      const reservation = await tx.inventoryReservation.update({
        where: {
          id: existing.id,
        },
        data: {
          status: ReservationStatus.consumed,
          consumedAt,
        },
      });

      await this.inventoryBalanceService.recalculateInventoryBalanceForProduct(
        accountId,
        existing.productId,
        existing.locationCode,
        tx,
      );

      return reservation;
    });
  }

  async consumeOrderLineReservation(input: {
    accountId: bigint;
    orderLineId: string;
  }) {
    const { accountId, orderLineId } = input;
    const iOrderLineId = this.parseRequiredBigInt(orderLineId, 'orderLineId');

    const reservation = await this.prismaService.inventoryReservation.findFirst(
      {
        where: {
          accountId,
          sourceType: ReservationSourceType.sales_order_line,
          sourceId: iOrderLineId,
          status: ReservationStatus.active,
        },
        select: { id: true },
      },
    );

    if (!reservation) {
      throw new NotFoundException(
        `Active reservation for order line ${orderLineId} not found`,
      );
    }

    return this.consumeReservation({
      accountId,
      reservationId: reservation.id.toString(),
    });
  }

  private parseBigIntField(value: string, fieldName: string): bigint {
    if (value.trim() === '') {
      throw new BadRequestException(`Invalid ${fieldName} ${value}`);
    }

    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName} ${value}`);
    }
  }

  private parseRequiredBigInt(
    value: string | undefined,
    fieldName: string,
  ): bigint {
    if (value === undefined) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return this.parseBigIntField(value, fieldName);
  }

  private parseLocationCode(value: string, fieldName: string): string {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`Invalid ${fieldName} ${value}`);
    }
    return trimmed;
  }

  private parseRequiredLocationCode(
    value: string | undefined,
    fieldName: string,
  ): string {
    if (value === undefined) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return this.parseLocationCode(value, fieldName);
  }

  private parseOptionalPositiveInteger(
    value: number | undefined,
    fieldName: string,
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`Invalid ${fieldName} value ${value}`);
    }

    return value;
  }
  private parseRequiredPositiveDecimal(
    value: string | undefined,
    fieldName: string,
  ): Prisma.Decimal {
    if (value === undefined) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (value.trim() === '') {
      throw new BadRequestException(`Invalid ${fieldName} ${value}`);
    }

    let decimal: Prisma.Decimal;
    try {
      decimal = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName} ${value}`);
    }

    if (decimal.lte(0)) {
      throw new BadRequestException(`${fieldName} must be greater than zero.`);
    }

    return decimal;
  }
}
