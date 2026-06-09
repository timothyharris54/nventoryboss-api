import { Injectable } from '@nestjs/common';
import { VendorProduct } from '@prisma/client';

@Injectable()
export class VendorProductSelectorService {
  select(vendorProducts: VendorProduct[]): VendorProduct | null {
    const active = vendorProducts.filter((vp) => vp.isActive);
    if (active.length === 0) {
      return null;
    }

    const primary = active.filter((vp) => vp.isPrimaryVendor);
    if (primary.length === 1) {
      return primary[0];
    }

    if (primary.length > 1) {
      return primary.sort((a, b) => Number(a.id - b.id))[0];
    }

    if (active.length === 1) {
      return active[0];
    }

    return null;
  }
}
