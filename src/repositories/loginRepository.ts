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
    const profile = await this.findProfileByPrincipal(principal);
    return profile?.role ?? null;
  }

  async findProfileByPrincipal(principal: AuthPrincipal): Promise<{
    role: string;
    firstName: string;
    surname: string;
  } | null> {
    if (principal.type === 'customer') {
      const customer = await this.prisma.customer.findUnique({
        where: { customerID: principal.id },
        select: { customerForename: true, customerSurname: true },
      });
      return customer
        ? {
            role: 'customer',
            firstName: customer.customerForename,
            surname: customer.customerSurname,
          }
        : null;
    }

    const staff = await this.prisma.staff.findUnique({
      where: { staffID: principal.id },
      select: { staffRole: true, staffForename: true, staffSurname: true },
    });
    return staff
      ? {
          role: staff.staffRole.toLowerCase(),
          firstName: staff.staffForename,
          surname: staff.staffSurname,
        }
      : null;
  }
}
