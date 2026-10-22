import type { Customer, PrismaClient } from '../generated/prisma/client';

export class LoginRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findCustomerByEmail(email: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { customerEmail: email },
    });
  }
}
