import { PrismaService } from '../../../src/common/prisma/prisma.service';

export async function resetDatabase(prisma: PrismaService) {
  await prisma.salesDaily.deleteMany();
  await prisma.reorderRecommendation.deleteMany();
  await prisma.replenishmentRule.deleteMany();
  await prisma.planningSettings.deleteMany();
  await prisma.receiptLine.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.vendorProduct.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.inventoryLedger.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
}
