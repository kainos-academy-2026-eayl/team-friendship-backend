import type { Prisma, PrismaClient } from '../generated/prisma/client';
import { calculateDiscount, type Discount } from '../models/discountModel';
import type { DeliveryAddress, OrderItem } from '../models/orderModel';
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

export const INITIAL_ORDER_STATUS = 'pending';

export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(
    customerID: number,
    items: OrderItem[],
    deliveryAddress?: DeliveryAddress,
    discount?: Discount,
  ): Promise<OrderWithServices> {
    return this.prisma.$transaction(async (tx) => {
      // Fall back to the customer's saved address when no alternative is supplied.
      const { address, postcode } =
        deliveryAddress ??
        (await tx.customer.findUniqueOrThrow({
          where: { customerID },
          select: { address: true, postcode: true },
        }));

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

      let discountAmount = 0;
      if (discount) {
        // Prices are read inside the transaction so the discount matches the stock just reserved.
        const products = await tx.product.findMany({
          where: { productID: { in: items.map((item) => item.productID) } },
          select: { productID: true, productPrice: true },
        });
        const subtotal = items.reduce((sum, item) => {
          const price =
            products.find((product) => product.productID === item.productID)
              ?.productPrice ?? 0;
          return sum + price * item.quantity;
        }, 0);
        discountAmount = calculateDiscount(subtotal, discount.percentOff);
      }

      return tx.order.create({
        data: {
          customerID,
          status: INITIAL_ORDER_STATUS,
          address,
          postcode,
          discountCode: discount?.code ?? null,
          discountAmount,
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
