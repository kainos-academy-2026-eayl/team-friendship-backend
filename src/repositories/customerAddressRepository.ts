import type { PrismaClient } from '../generated/prisma/client';
import type { DeliveryAddress } from '../models/orderModel';

export class CustomerAddressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByCustomerId(customerID: number): Promise<DeliveryAddress | null> {
    return this.prisma.customer.findUnique({
      where: { customerID },
      select: { address: true, postcode: true },
    });
  }
}
