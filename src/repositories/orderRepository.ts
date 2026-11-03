import type {
  Order,
  OrderService,
  PrismaClient,
} from '../generated/prisma/client';

export interface CreateOrderInput {
  customerID: number;
  status: string;
  orderServices: {
    productID: number;
    quantity: number;
  }[];
}

export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: CreateOrderInput,
  ): Promise<Order & { orderServices: OrderService[] }> {
    return this.prisma.order.create({
      data: {
        customerID: input.customerID,
        status: input.status,
        orderServices: {
          create: input.orderServices.map((service) => ({
            productID: service.productID,
            quantity: service.quantity,
          })),
        },
      },
      include: {
        orderServices: true,
      },
    }) as Promise<Order & { orderServices: OrderService[] }>;
  }

  async findById(
    orderID: number,
    customerID: number,
  ): Promise<(Order & { orderServices: OrderService[] }) | null> {
    return this.prisma.order.findFirst({
      where: { orderID, customerID },
      include: {
        orderServices: true,
      },
    }) as Promise<(Order & { orderServices: OrderService[] }) | null>;
  }

  async findByCustomerId(
    customerID: number,
  ): Promise<(Order & { orderServices: OrderService[] })[]> {
    return this.prisma.order.findMany({
      where: { customerID },
      include: {
        orderServices: true,
      },
      orderBy: { dateCreated: 'desc' },
    }) as Promise<(Order & { orderServices: OrderService[] })[]>;
  }
}
