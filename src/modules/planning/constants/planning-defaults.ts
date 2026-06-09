// export const DEFAULT_DEMAND_ORDER_STATUSES = [
//   'completed',
//   'processing',
//   'paid',
// ];
export const DEFAULT_DEMAND_ORDER_STATUSES = ['completed'] as const;
export const DEFAULT_DEMAND_DATE_BASIS = 'orderedAt' as const;
export const DEFAULT_LOOKBACK_DAYS = 30;
export const DEFAULT_LEAD_TIME_DAYS = 7;
export const DEFAULT_SAFETY_DAYS = 7;
