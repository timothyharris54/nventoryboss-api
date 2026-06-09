export type VendorProduct = {
  id: string;
  accountId: string;
  vendorId: string;
  productId: string;
  vendorSku: string | null;
  unitCost: string;
  minOrderQty: string;
  orderMultiple: string;
  leadTimeDays: number | null;
  isPrimaryVendor: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VendorProductWithVendor = {
  vendorProduct: VendorProduct;
  vendor: {
    id: string;
    accountId: string;
    name: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    defaultLeadTimeDays: number | null;
    paymentTerms: string | null;
    isActive: boolean;
    isPreferred: boolean;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
};
