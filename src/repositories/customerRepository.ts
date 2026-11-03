import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  type CustomerRecord,
  type CustomerRepository,
  DuplicateCustomerEmailError,
  type NewCustomer,
} from '../models/customerModel';
import type { PasswordResetRepository } from '../models/passwordResetModel';

let prisma: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  return prisma;
}

export class PrismaCustomerRepository implements CustomerRepository {
  async create(customer: NewCustomer): Promise<CustomerRecord> {
    try {
      return await getPrismaClient().customer.create({ data: customer });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DuplicateCustomerEmailError();
      }

      throw error;
    }
  }
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  async createResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string | null> {
    const client = getPrismaClient();
    const customer = await client.customer.findFirst({
      where: { customerEmail: { equals: email, mode: 'insensitive' } },
      select: { customerEmail: true },
    });

    if (!customer) return null;

    await client.$transaction([
      client.passwordResetToken.deleteMany({
        where: { customerEmail: customer.customerEmail },
      }),
      client.passwordResetToken.create({
        data: {
          customerEmail: customer.customerEmail,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    return customer.customerEmail;
  }

  async resetPassword(
    email: string,
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean> {
    return getPrismaClient().$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: now },
          customer: {
            customerEmail: { equals: email, mode: 'insensitive' },
          },
        },
        select: { id: true, customerEmail: true },
      });

      if (!resetToken) return false;

      const consumed = await transaction.passwordResetToken.deleteMany({
        where: {
          id: resetToken.id,
          tokenHash,
          expiresAt: { gt: now },
        },
      });
      if (consumed.count !== 1) return false;

      await transaction.customer.update({
        where: { customerEmail: resetToken.customerEmail },
        data: { customerPassword: passwordHash },
      });
      await transaction.passwordResetToken.deleteMany({
        where: { customerEmail: resetToken.customerEmail },
      });

      return true;
    });
  }
}
