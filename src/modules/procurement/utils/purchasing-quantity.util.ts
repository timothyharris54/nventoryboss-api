import { Prisma } from '@prisma/client';
/*
    Adjusts recommended quantity to purchasing constraints like MOQ
    and order multiples.
*/
export function adjustToPurchasingConstraints(
  recommendedQty: Prisma.Decimal,
  minOrderQty: Prisma.Decimal,
  orderMultiple: Prisma.Decimal,
): Prisma.Decimal {
  let qty = recommendedQty;

  if (qty.lt(minOrderQty)) {
    qty = minOrderQty;
  }

  if (orderMultiple.gt(1)) {
    const remainder = qty.mod(orderMultiple);
    if (!remainder.eq(0)) {
      qty = qty.add(orderMultiple.sub(remainder));
    }
  }

  return qty;
}
