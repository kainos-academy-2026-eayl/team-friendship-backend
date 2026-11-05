import type { Basket, PrismaClient } from '../generated/prisma/client';

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

  addItem(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<Basket> {
    return this.prisma.basket.create({
      data: {
        customerID,
        productID,
        quantity,
      },
    });
  }

  updateQuantity(basketID: number, quantity: number): Promise<Basket> {
    return this.prisma.basket.update({
      where: { basketID },
      data: { quantity },
    });
  }

  removeItem(basketID: number): Promise<Basket> {
    return this.prisma.basket.delete({
      where: { basketID },
    });
  }
}
