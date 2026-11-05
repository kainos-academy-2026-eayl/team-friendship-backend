import type { PrismaClient } from '../generated/prisma/client';

export class OrderHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrderHistoryByCustomerID(customerID: number) {
    return this.prisma.order.findMany({
      where: {
        customerID,
      },
      include: {
        orderServices: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        dateCreated: 'desc',
      },
    });
  }
}
