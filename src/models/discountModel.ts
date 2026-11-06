export interface Discount {
  id: number;
  code: string;
  percentOff: number;
}

export interface DiscountCodeRecord {
  id: number;
  code: string;
  discount: number;
  status: string;
  expiryDate: Date | null;
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

// A code can be used while it is ACTIVE and its expiry date (if any) has not passed.
export function isUsable(
  record: DiscountCodeRecord,
  now = new Date(),
): boolean {
  return (
    record.status === 'ACTIVE' &&
    (record.expiryDate === null || record.expiryDate > now)
  );
}

export function toDiscount(record: DiscountCodeRecord): Discount {
  return { id: record.id, code: record.code, percentOff: record.discount };
}

// Calculated in whole pence so the stored amount matches what checkout displays.
export function calculateDiscount(
  subtotal: number,
  percentOff: number,
): number {
  const subtotalPence = Math.round(subtotal * 100);
  return Math.round((subtotalPence * percentOff) / 100) / 100;
}
