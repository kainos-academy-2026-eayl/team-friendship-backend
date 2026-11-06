import type { Basket, Prisma, PrismaClient } from '../generated/prisma/client';
import { BasketError, type BasketQuantityChange } from '../models/basketModel';

export class BasketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll(customerID: number): Promise<Basket[]> {
    return this.prisma.basket.findMany({
      where: { customerID },
      orderBy: { basketID: 'asc' },
      include: {
        product: true,
      },
    });
  }

  private async lockProduct(tx: Prisma.TransactionClient, productID: number) {
    // Serialize stock checks with other basket changes and order stock decrements.
    const products = await tx.$queryRaw<{ productStock: number }[]>`
      SELECT "productStock" FROM "Product"
      WHERE "productID" = ${productID} FOR UPDATE
    `;
    const product = products[0];
    if (!product) throw new BasketError(404, 'Product not found.');
    return product.productStock;
  }

  addItem(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<Basket> {
    return this.prisma.$transaction(async (tx) => {
      const stock = await this.lockProduct(tx, productID);
      const existing = await tx.basket.aggregate({
        where: { customerID, productID },
        _sum: { quantity: true },
      });
      if ((existing._sum.quantity ?? 0) + quantity > stock) {
        throw new BasketError(
          409,
          'Not enough stock. The quantity already in your basket counts towards the stock limit.',
        );
      }
      return tx.basket.create({ data: { customerID, productID, quantity } });
    });
  }

  updateQuantity(
    customerID: number,
    basketID: number,
    input: BasketQuantityChange,
  ): Promise<Basket> {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.basket.findFirst({
        where: { customerID, basketID },
      });
      if (!initial) throw new BasketError(404, 'Basket item not found.');
      const stock = await this.lockProduct(tx, initial.productID);
      const item = await tx.basket.findFirst({
        where: { customerID, basketID },
      });
      if (!item) throw new BasketError(404, 'Basket item not found.');
      const quantity =
        'change' in input ? item.quantity + input.change : input.quantity;
      if (quantity < 1 || quantity > 2147483647) {
        throw new BasketError(400, 'Quantity must be a positive whole number.');
      }
      const existing = await tx.basket.aggregate({
        where: { customerID, productID: item.productID },
        _sum: { quantity: true },
      });
      // Allow reductions if stock has fallen below the quantity already in the basket.
      if (
        quantity > item.quantity &&
        (existing._sum.quantity ?? 0) - item.quantity + quantity > stock
      ) {
        throw new BasketError(
          409,
          'Stock limit reached. You cannot add any more of this product.',
        );
      }
      return tx.basket.update({ where: { basketID }, data: { quantity } });
    });
  }

  removeItem(customerID: number, basketID: number): Promise<Basket> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.basket.findFirst({
        where: { customerID, basketID },
      });
      if (!item) throw new BasketError(404, 'Basket item not found.');
      await this.lockProduct(tx, item.productID);
      return tx.basket.delete({ where: { basketID } });
    });
  }
}
