import type { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  InsufficientStockError,
  OrderProductNotFoundError,
} from '../services/orderService';

const orderWithServices = {
  orderServices: {
    include: { product: true },
    orderBy: { productID: 'asc' },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithServices = Prisma.OrderGetPayload<{
  include: typeof orderWithServices;
}>;

export interface OrderItem {
  productID: number;
  quantity: number;
}

export const INITIAL_ORDER_STATUS = 'pending';

export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(customerID: number, items: OrderItem[]): Promise<OrderWithServices> {
    return this.prisma.$transaction(async (tx) => {
      // Iterate over a copy sorted by productID so every order
      // acquires product locks in the same order.
      for (const { productID, quantity } of [...items].sort(
        (a, b) => a.productID - b.productID,
      )) {
        // Conditional decrement prevents overselling when orders race for the same stock.
        const { count } = await tx.product.updateMany({
          where: { productID, productStock: { gte: quantity } },
          data: { productStock: { decrement: quantity } },
        });
        if (count === 0) {
          const exists = await tx.product.findUnique({
            where: { productID },
            select: { productID: true },
          });
          throw exists
            ? new InsufficientStockError(productID)
            : new OrderProductNotFoundError(productID);
        }
      }

      return tx.order.create({
        data: {
          customerID,
          status: INITIAL_ORDER_STATUS,
          orderServices: { create: items },
        },
        include: orderWithServices,
      });
    });
  }

  findById(orderID: number): Promise<OrderWithServices | null> {
    return this.prisma.order.findUnique({
      where: { orderID },
      include: orderWithServices,
    });
  }

  findByCustomerId(customerID: number): Promise<OrderWithServices[]> {
    return this.prisma.order.findMany({
      where: { customerID },
      include: orderWithServices,
      orderBy: [{ dateCreated: 'desc' }, { orderID: 'desc' }],
    });
  }
}
