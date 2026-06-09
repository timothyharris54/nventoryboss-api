/*
async function seedBasicOrder({
  accountId,
  productId,
  status = 'completed',
  quantity = '2.00',
  unitPrice = '10.00',
  lineTotal = '20.00',
}) {
  const order = await prisma.order.create({
    data: {
      accountId,
      channel: 'manual',
      channelOrderId: crypto.randomUUID(),
      status,
      orderedAt: new Date('2026-03-20T10:00:00Z'),
    },
  });

  await prisma.orderLine.create({
    data: {
      accountId,
      orderId: order.id,
      productId,
      quantity,
      unitPrice,
      lineTotal,
    },
  });

  return order;
}
  */
