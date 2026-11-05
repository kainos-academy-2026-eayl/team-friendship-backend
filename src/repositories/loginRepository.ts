import type { Customer, PrismaClient, Staff } from '../generated/prisma/client';
import type { AuthPrincipal } from '../services/accessTokenService';

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

  async findStaffByEmail(email: string): Promise<Staff | null> {
    const [staff] = await this.prisma.$queryRaw<Staff[]>`
      SELECT *
      FROM "Staff"
      WHERE lower("staffEmail") = lower(${email})
      LIMIT 1
    `;
    return staff ?? null;
  }

  async findRoleByPrincipal(principal: AuthPrincipal): Promise<string | null> {
    if (principal.type === 'customer') {
      const customer = await this.prisma.customer.findUnique({
        where: { customerID: principal.id },
        select: { customerID: true },
      });
      return customer ? 'customer' : null;
    }

    const staff = await this.prisma.staff.findUnique({
      where: { staffID: principal.id },
      select: { staffRole: true },
    });
    return staff?.staffRole.toLowerCase() ?? null;
  }
}
