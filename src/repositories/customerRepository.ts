import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

export interface CustomerRecord {
  customerID: number;
  customerForename: string;
  customerSurname: string;
  address: string;
  postcode: string;
  customerEmail: string;
  customerPhone: string;
  customerPassword: string;
}

export type NewCustomer = Omit<CustomerRecord, 'customerID'>;

export interface CustomerRepository {
  create(customer: NewCustomer): Promise<CustomerRecord>;
}

export class DuplicateCustomerEmailError extends Error {
  constructor() {
    super('An account with this username already exists.');
    this.name = 'DuplicateCustomerEmailError';
  }
}

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
