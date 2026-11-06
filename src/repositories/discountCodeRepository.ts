import type { PrismaClient } from '../generated/prisma/client';
import {
  type Discount,
  isUsable,
  normaliseCode,
  toDiscount,
} from '../models/discountModel';

export const MAX_DISCOUNT_CODE_LENGTH = 50;

export class DiscountCodeRepository {
  constructor(private readonly prisma: Pick<PrismaClient, 'discountCode'>) {}

  // Returns null for unknown, disabled, expired or out-of-date codes alike.
  async findUsableByCode(
    code: string,
    now = new Date(),
  ): Promise<Discount | null> {
    const normalised = normaliseCode(code);
    if (!normalised || normalised.length > MAX_DISCOUNT_CODE_LENGTH) {
      return null;
    }

    const record = await this.prisma.discountCode.findUnique({
      where: { code: normalised },
    });
    return record && isUsable(record, now) ? toDiscount(record) : null;
  }
}
