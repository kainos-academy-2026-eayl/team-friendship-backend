import type { Customer, PrismaClient } from '../generated/prisma/client';

export class LoginRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCustomerByEmail(email: string): Promise<Customer | null> {
    const [customer] = await this.prisma.$queryRaw<Customer[]>`
      SELECT *
      FROM "Customer"
      WHERE lower("customerEmail") = lower(${email})
      LIMIT 1
    `;
    return customer ?? null;
  }

  async findRoleByCustomerId(
    customerID: number,
  ): Promise<'admin' | 'customer' | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { customerID },
      select: { role: true },
    });
    if (!customer) return null;
    return customer.role === 'ADMIN' ? 'admin' : 'customer';
  }
}
