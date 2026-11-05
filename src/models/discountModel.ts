export interface Discount {
  code: string;
  percentOff: number;
}

const DISCOUNTS: readonly Discount[] = [
  { code: 'FRIENDSHIP12', percentOff: 12 },
];

export function findDiscount(code: string): Discount | undefined {
  const normalised = code.trim().toUpperCase();
  return DISCOUNTS.find((discount) => discount.code === normalised);
}

// Calculated in whole pence so the stored amount matches what checkout displays.
export function calculateDiscount(
  subtotal: number,
  percentOff: number,
): number {
  const subtotalPence = Math.round(subtotal * 100);
  return Math.round((subtotalPence * percentOff) / 100) / 100;
}
