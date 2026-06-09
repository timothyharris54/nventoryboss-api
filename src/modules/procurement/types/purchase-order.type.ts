import { VendorProduct } from '../../vendor-products/dto/vendor-product.type';
export type PurchaseOrderDetail = {
  id: string;
  accountId: string;
  vendorId: string;
  poNumber: string;
  locationCode: string;
  status: string;
  orderedAt: string;
  expectedAt: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  vendor: PurchaseOrderVendor;
  lines: PurchaseOrderLine[];
  receipts: PurchaseOrderReceipt[];
};

export type PurchaseOrderVendor = {
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

export type PurchaseOrderLine = {
  id: string;
  accountId: string;
  purchaseOrderId: string;
  productId: string;
  vendorProductId: string | null;
  orderedQty: string;
  receivedQty: string;
  unitCost: string;
  lineTotal: string;
  createdAt: string;
  updatedAt: string;

  product: PurchaseOrderProduct;
  vendorProduct: VendorProduct | null;
};

export type PurchaseOrderProduct = {
  id: string;
  accountId: string;
  sku: string;
  name: string;
  status: string;
  isVariant: boolean;
  parentProductId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderReceipt = {
  id: string;
  accountId: string;
  purchaseOrderId: string;
  locationCode: string;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
};
