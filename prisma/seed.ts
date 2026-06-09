import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const dec = (value: string | number) => new Prisma.Decimal(value);
const userRoles = [
  { code: 'executive', displayName: 'Executive' },
  { code: 'purchasing_manager', displayName: 'Purchasing Manager' },
  { code: 'buyer', displayName: 'Buyer' },
  { code: 'planner', displayName: 'Planner' },
  { code: 'warehouse_manager', displayName: 'Warehouse Manager' },
  { code: 'warehouse_user', displayName: 'Warehouse User' },
  { code: 'system_admin', displayName: 'System Admin' },
] as const;
const daysAgoUtc = (daysAgo: number, hour = 12, minute = 0) => {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
};

async function resetDemoData() {
  await prisma.location.deleteMany();
  await prisma.receiptLine.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.reorderRecommendation.deleteMany();
  await prisma.replenishmentRule.deleteMany();
  await prisma.salesDaily.deleteMany();
  await prisma.vendorProduct.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.inventoryLedger.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.planningSettings.deleteMany();
  await prisma.product.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
}

async function main() {
  await resetDemoData();

  const roles = await Promise.all(
    userRoles.map((role) =>
      prisma.role.upsert({
        where: {
          code: role.code,
        },
        update: {
          displayName: role.displayName,
          isActive: true,
        },
        create: {
          code: role.code,
          displayName: role.displayName,
        },
      }),
    ),
  );

  const account = await prisma.account.create({
    data: {
      name: 'Local Demo Account',
    },
  });

  const user = await prisma.user.create({
    data: {
      accountId: account.id,
      email: 'timothy.harris54@gmail.com',
      fullName: 'Timothy Harris',
    },
  });

  await prisma.userRole.createMany({
    data: roles.map((role) => ({
      accountId: account.id,
      userId: user.id,
      roleId: role.id,
    })),
  });

  await prisma.planningSettings.create({
    data: {
      accountId: account.id,
      demandOrderStatuses: ['completed', 'processing'],
      demandDateBasis: 'orderedAt',
      includeNegativeAdjustments: false,
    },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'WB-100',
        name: 'Widget Basic',
      },
    }),
    prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'WP-200',
        name: 'Widget Pro',
      },
    }),
    prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'GK-300',
        name: 'Gizmo Kit',
      },
    }),
    prisma.product.create({
      data: {
        accountId: account.id,
        sku: 'AC-400',
        name: 'Accessory Pack',
      },
    }),
  ]);

  const productBySku = new Map(
    products.map((product) => [product.sku, product]),
  );

  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        accountId: account.id,
        name: 'Northwind Supply',
        contactName: 'Morgan Lee',
        contactEmail: 'purchasing@northwind.example',
        defaultLeadTimeDays: 10,
        paymentTerms: 'Net 30',
        isPreferred: true,
      },
    }),
    prisma.vendor.create({
      data: {
        accountId: account.id,
        name: 'BlueRock Industrial',
        contactName: 'Avery Chen',
        contactEmail: 'sales@bluerock.example',
        defaultLeadTimeDays: 18,
        paymentTerms: 'Net 15',
      },
    }),
    prisma.vendor.create({
      data: {
        accountId: account.id,
        name: 'Summit Components',
        contactName: 'Riley Patel',
        contactEmail: 'orders@summit.example',
        defaultLeadTimeDays: 7,
        paymentTerms: 'Prepaid',
      },
    }),
  ]);

  const vendorByName = new Map(vendors.map((vendor) => [vendor.name, vendor]));

  const vendorProducts = await Promise.all([
    prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendorByName.get('Northwind Supply')!.id,
        productId: productBySku.get('WB-100')!.id,
        vendorSku: 'NW-WB-100',
        unitCost: dec('8.25'),
        minOrderQty: dec('24'),
        orderMultiple: dec('12'),
        leadTimeDays: 10,
        isPrimaryVendor: true,
      },
    }),
    prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendorByName.get('Northwind Supply')!.id,
        productId: productBySku.get('WP-200')!.id,
        vendorSku: 'NW-WP-200',
        unitCost: dec('13.75'),
        minOrderQty: dec('12'),
        orderMultiple: dec('6'),
        leadTimeDays: 10,
        isPrimaryVendor: true,
      },
    }),
    prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendorByName.get('BlueRock Industrial')!.id,
        productId: productBySku.get('WP-200')!.id,
        vendorSku: 'BR-WP-200',
        unitCost: dec('14.10'),
        minOrderQty: dec('18'),
        orderMultiple: dec('6'),
        leadTimeDays: 16,
      },
    }),
    prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendorByName.get('BlueRock Industrial')!.id,
        productId: productBySku.get('GK-300')!.id,
        vendorSku: 'BR-GK-300',
        unitCost: dec('21.40'),
        minOrderQty: dec('10'),
        orderMultiple: dec('5'),
        leadTimeDays: 18,
        isPrimaryVendor: true,
      },
    }),
    prisma.vendorProduct.create({
      data: {
        accountId: account.id,
        vendorId: vendorByName.get('Summit Components')!.id,
        productId: productBySku.get('AC-400')!.id,
        vendorSku: 'SC-AC-400',
        unitCost: dec('3.10'),
        minOrderQty: dec('50'),
        orderMultiple: dec('25'),
        leadTimeDays: 7,
        isPrimaryVendor: true,
      },
    }),
  ]);

  const vendorProductByKey = new Map(
    vendorProducts.map((vendorProduct) => [
      `${vendorProduct.vendorId}:${vendorProduct.productId}`,
      vendorProduct,
    ]),
  );

  await prisma.inventoryBalance.createMany({
    data: [
      {
        accountId: account.id,
        productId: productBySku.get('WB-100')!.id,
        locationCode: 'MAIN',
        qtyOnHand: dec('20'),
        qtyReserved: dec('8'),
        qtyIncoming: dec('0'),
        qtyAvailable: dec('12'),
      },
      {
        accountId: account.id,
        productId: productBySku.get('WP-200')!.id,
        locationCode: 'MAIN',
        qtyOnHand: dec('12'),
        qtyReserved: dec('4'),
        qtyIncoming: dec('0'),
        qtyAvailable: dec('8'),
      },
      {
        accountId: account.id,
        productId: productBySku.get('GK-300')!.id,
        locationCode: 'MAIN',
        qtyOnHand: dec('7'),
        qtyReserved: dec('2'),
        qtyIncoming: dec('0'),
        qtyAvailable: dec('5'),
      },
      {
        accountId: account.id,
        productId: productBySku.get('AC-400')!.id,
        locationCode: 'MAIN',
        qtyOnHand: dec('36'),
        qtyReserved: dec('16'),
        qtyIncoming: dec('0'),
        qtyAvailable: dec('20'),
      },
    ],
  });

  await prisma.inventoryLedger.createMany({
    data: [
      {
        accountId: account.id,
        productId: productBySku.get('WB-100')!.id,
        locationCode: 'MAIN',
        eventType: 'opening_balance',
        quantityDelta: dec('120'),
        referenceType: 'system',
        externalEventKey: `seed:${account.id}:inventory:wb-100:opening`,
        occurredAt: new Date('2026-03-01T08:00:00.000Z'),
        notes: 'Seed opening balance',
      },
      {
        accountId: account.id,
        productId: productBySku.get('WP-200')!.id,
        locationCode: 'MAIN',
        eventType: 'opening_balance',
        quantityDelta: dec('28'),
        referenceType: 'system',
        externalEventKey: `seed:${account.id}:inventory:wp-200:opening`,
        occurredAt: new Date('2026-03-01T08:00:00.000Z'),
        notes: 'Seed opening balance',
      },
      {
        accountId: account.id,
        productId: productBySku.get('GK-300')!.id,
        locationCode: 'MAIN',
        eventType: 'opening_balance',
        quantityDelta: dec('14'),
        referenceType: 'system',
        externalEventKey: `seed:${account.id}:inventory:gk-300:opening`,
        occurredAt: new Date('2026-03-01T08:00:00.000Z'),
        notes: 'Seed opening balance',
      },
      {
        accountId: account.id,
        productId: productBySku.get('AC-400')!.id,
        locationCode: 'MAIN',
        eventType: 'opening_balance',
        quantityDelta: dec('260'),
        referenceType: 'system',
        externalEventKey: `seed:${account.id}:inventory:ac-400:opening`,
        occurredAt: new Date('2026-03-01T08:00:00.000Z'),
        notes: 'Seed opening balance',
      },
    ],
  });

  await prisma.replenishmentRule.createMany({
    data: [
      {
        accountId: account.id,
        productId: productBySku.get('WB-100')!.id,
        locationCode: 'MAIN',
        safetyStock: dec('20'),
        targetDaysOfCover: 21,
        overrideLeadTimeDays: 10,
        minReorderQty: dec('24'),
        isActive: true,
      },
      {
        accountId: account.id,
        productId: productBySku.get('WP-200')!.id,
        locationCode: 'MAIN',
        safetyStock: dec('12'),
        targetDaysOfCover: 30,
        overrideLeadTimeDays: 12,
        minReorderQty: dec('18'),
        isActive: true,
      },
      {
        accountId: account.id,
        productId: productBySku.get('GK-300')!.id,
        locationCode: 'MAIN',
        safetyStock: dec('8'),
        targetDaysOfCover: 35,
        overrideLeadTimeDays: 18,
        minReorderQty: dec('10'),
        isActive: true,
      },
      {
        accountId: account.id,
        productId: productBySku.get('AC-400')!.id,
        locationCode: 'MAIN',
        safetyStock: dec('30'),
        targetDaysOfCover: 14,
        overrideLeadTimeDays: 7,
        minReorderQty: dec('50'),
        isActive: true,
      },
    ],
  });

  const salesDailyRows = [
    ['WB-100', 28, '6', '179.94'],
    ['WB-100', 24, '5', '149.95'],
    ['WB-100', 17, '7', '209.93'],
    ['WB-100', 9, '4', '119.96'],
    ['WP-200', 27, '2', '119.98'],
    ['WP-200', 20, '3', '179.97'],
    ['WP-200', 12, '4', '239.96'],
    ['GK-300', 26, '1', '89.99'],
    ['GK-300', 16, '2', '179.98'],
    ['GK-300', 8, '2', '179.98'],
    ['AC-400', 25, '8', '119.92'],
    ['AC-400', 15, '10', '149.90'],
    ['AC-400', 5, '6', '89.94'],
  ] as const;

  await prisma.salesDaily.createMany({
    data: salesDailyRows.map(([sku, daysAgo, unitsSold, revenue]) => ({
      accountId: account.id,
      productId: productBySku.get(sku)!.id,
      salesDate: daysAgoUtc(daysAgo, 0),
      unitsSold: dec(unitsSold),
      revenue: dec(revenue),
    })),
  });

  const orders = await Promise.all([
    prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'shopify',
        channelOrderId: 'SP-1001',
        status: 'completed',
        orderedAt: daysAgoUtc(7, 14, 15),
        customerName: 'Alice Carter',
        customerEmail: 'alice@example.com',
        currencyCode: 'USD',
        orderTotal: dec('109.97'),
      },
    }),
    prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'amazon',
        channelOrderId: 'AMZ-2048',
        status: 'processing',
        orderedAt: daysAgoUtc(5, 18, 45),
        customerName: 'Jordan Rivera',
        customerEmail: 'jordan@example.com',
        currencyCode: 'USD',
        orderTotal: dec('239.96'),
      },
    }),
    prisma.order.create({
      data: {
        accountId: account.id,
        channel: 'manual',
        channelOrderId: 'B2B-9001',
        status: 'completed',
        orderedAt: daysAgoUtc(3, 9, 30),
        customerName: 'Acme Retail',
        customerEmail: 'buyer@acme.example',
        currencyCode: 'USD',
        orderTotal: dec('329.88'),
      },
    }),
  ]);

  await prisma.orderLine.createMany({
    data: [
      {
        accountId: account.id,
        orderId: orders[0].id,
        productId: productBySku.get('WB-100')!.id,
        channelLineId: 'SP-1001-1',
        sku: 'WB-100',
        productName: 'Widget Basic',
        quantity: dec('2'),
        unitPrice: dec('29.99'),
        lineTotal: dec('59.98'),
      },
      {
        accountId: account.id,
        orderId: orders[0].id,
        productId: productBySku.get('AC-400')!.id,
        channelLineId: 'SP-1001-2',
        sku: 'AC-400',
        productName: 'Accessory Pack',
        quantity: dec('1'),
        unitPrice: dec('49.99'),
        lineTotal: dec('49.99'),
      },
      {
        accountId: account.id,
        orderId: orders[1].id,
        productId: productBySku.get('WP-200')!.id,
        channelLineId: 'AMZ-2048-1',
        sku: 'WP-200',
        productName: 'Widget Pro',
        quantity: dec('4'),
        unitPrice: dec('59.99'),
        lineTotal: dec('239.96'),
      },
      {
        accountId: account.id,
        orderId: orders[2].id,
        productId: productBySku.get('GK-300')!.id,
        channelLineId: 'B2B-9001-1',
        sku: 'GK-300',
        productName: 'Gizmo Kit',
        quantity: dec('2'),
        unitPrice: dec('89.99'),
        lineTotal: dec('179.98'),
      },
      {
        accountId: account.id,
        orderId: orders[2].id,
        productId: productBySku.get('WB-100')!.id,
        channelLineId: 'B2B-9001-2',
        sku: 'WB-100',
        productName: 'Widget Basic',
        quantity: dec('5'),
        unitPrice: dec('29.98'),
        lineTotal: dec('149.90'),
      },
    ],
  });

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      accountId: account.id,
      vendorId: vendorByName.get('Northwind Supply')!.id,
      poNumber: 'PO-10001',
      status: 'partially_received',
      orderedAt: new Date('2026-03-18T12:00:00.000Z'),
      expectedAt: new Date('2026-03-30T00:00:00.000Z'),
      submittedAt: new Date('2026-03-18T12:05:00.000Z'),
      notes: 'Restock fast movers',
    },
  });

  const purchaseOrderLine1 = await prisma.purchaseOrderLine.create({
    data: {
      accountId: account.id,
      purchaseOrderId: purchaseOrder.id,
      productId: productBySku.get('WB-100')!.id,
      vendorProductId: vendorProductByKey.get(
        `${vendorByName.get('Northwind Supply')!.id}:${productBySku.get('WB-100')!.id}`,
      )!.id,
      orderedQty: dec('24'),
      receivedQty: dec('24'),
      unitCost: dec('8.25'),
      lineTotal: dec('198.00'),
    },
  });

  const purchaseOrderLine2 = await prisma.purchaseOrderLine.create({
    data: {
      accountId: account.id,
      purchaseOrderId: purchaseOrder.id,
      productId: productBySku.get('WP-200')!.id,
      vendorProductId: vendorProductByKey.get(
        `${vendorByName.get('Northwind Supply')!.id}:${productBySku.get('WP-200')!.id}`,
      )!.id,
      orderedQty: dec('18'),
      receivedQty: dec('6'),
      unitCost: dec('13.75'),
      lineTotal: dec('247.50'),
    },
  });

  const receipt = await prisma.receipt.create({
    data: {
      accountId: account.id,
      purchaseOrderId: purchaseOrder.id,
      locationCode: 'MAIN',
      receivedAt: new Date('2026-03-25T10:00:00.000Z'),
      notes: 'Initial receipt against PO-10001',
    },
  });

  const location = await prisma.location.createMany({
    data: [
      {
        accountId: account.id,
        code: 'MAIN',
        name: 'Daytona Beach Warehouse',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        accountId: account.id,
        code: 'ORL',
        name: 'Orlando Fulfillment Center',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        accountId: account.id,
        code: 'TAM',
        name: 'Tampa Fulfillment Center',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  await prisma.receiptLine.createMany({
    data: [
      {
        accountId: account.id,
        receiptId: receipt.id,
        purchaseOrderLineId: purchaseOrderLine1.id,
        productId: productBySku.get('WB-100')!.id,
        receivedQty: dec('24'),
        unitCost: dec('8.25'),
      },
      {
        accountId: account.id,
        receiptId: receipt.id,
        purchaseOrderLineId: purchaseOrderLine2.id,
        productId: productBySku.get('WP-200')!.id,
        receivedQty: dec('6'),
        unitCost: dec('13.75'),
      },
    ],
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        accountId: account.id.toString(),
        userId: user.id.toString(),
        products: products.length,
        vendors: vendors.length,
        vendorProducts: vendorProducts.length,
        orders: orders.length,
        purchaseOrders: 1,
        receipts: 1,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
