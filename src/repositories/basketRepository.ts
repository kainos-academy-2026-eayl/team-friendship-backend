import type { Basket, PrismaClient } from '../generated/prisma/client';

export class BasketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll(customerID: number): Promise<Basket[]> {
    return this.prisma.basket.findMany({
      where: { customerID },
      orderBy: { basketID: 'asc' },
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

  removeItem(basketID: number): Promise<Basket> {
    return this.prisma.basket.delete({
      where: { basketID },
    });
  }
}
