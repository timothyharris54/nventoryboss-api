import { Prisma } from '@prisma/client';

export function getMovementDirection(
  quantityDelta: Prisma.Decimal,
): 'inbound' | 'outbound' | 'neutral' {
  if (quantityDelta.gt(0)) return 'inbound';
  if (quantityDelta.lt(0)) return 'outbound';
  return 'neutral';
}
