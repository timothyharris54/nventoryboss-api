export type ConversionPreviewSummary = {
  vendorGroups: Array<{
    vendorId: string;
    lineCount: number;
    totalOrderedQty: string;
    totalCost: string;
    lines: Array<{
      recommendationId: string;
      productId: string;
      vendorProductId: string;
      recommendedQty: string;
      finalQty: string;
      unitCost: string | null;
      lineTotal: string | null;
    }>;
  }>;
  totalGroups: number;
  totalRecommendations: number;
};
