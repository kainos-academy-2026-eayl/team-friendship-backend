import type { PrismaClient } from '../generated/prisma/client';
import type { CustomerDetailsUpdate } from '../models/customerDetailsModel';

export class CustomerDetailsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(customerID: number) {
    return this.prisma.customer.findUnique({
      where: { customerID },
      select: {
        customerID: true,
        customerForename: true,
        customerSurname: true,
        customerEmail: true,
        customerPhone: true,
        address: true,
        postcode: true,
      },
    });
  }

  async findPasswordById(customerID: number) {
    return this.prisma.customer.findUnique({
      where: { customerID },
      select: { customerPassword: true },
    });
  }

  async updateDetails(
    customerID: number,
    passwordHash: string,
    details: CustomerDetailsUpdate,
  ) {
    // A concurrent password reset must invalidate this password confirmation.
    const updated = await this.prisma.customer.updateMany({
      where: { customerID, customerPassword: passwordHash },
      data: details,
    });
    return updated.count === 1;
  }
}
