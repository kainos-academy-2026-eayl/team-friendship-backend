import argon2 from 'argon2';
import type { Customer } from '../generated/prisma/client';
import type { LoginRepository } from '../repositories/loginRepository';

export type CustomerDetails = Omit<Customer, 'customerPassword'>;

export const INVALID_CREDENTIALS_MESSAGE = 'Your email or password is invalid';

export class InvalidCredentialsError extends Error {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE);
    this.name = 'InvalidCredentialsError';
  }
}

type LoginRepositoryContract = Pick<LoginRepository, 'findCustomerByEmail'>;

// Verified when no customer matches, so unknown emails take as long as wrong passwords.
const DUMMY_HASH_PROMISE = argon2.hash('dummy-password-for-timing');

async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Stored value is not a valid argon2 hash.
    return false;
  }
}

export class LoginService {
  constructor(private readonly repository: LoginRepositoryContract) {}

  async login(email: string, password: string): Promise<CustomerDetails> {
    const customer = await this.repository.findCustomerByEmail(email);

    if (!customer) {
      await verifyPassword(await DUMMY_HASH_PROMISE, password);
      throw new InvalidCredentialsError();
    }

    if (!(await verifyPassword(customer.customerPassword, password))) {
      throw new InvalidCredentialsError();
    }

    const { customerPassword: _customerPassword, ...details } = customer;
    return details;
  }
}
