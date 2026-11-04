import argon2 from 'argon2';
import type { Customer, Staff } from '../generated/prisma/client';
import type { LoginRepository } from '../repositories/loginRepository';
import type { AuthPrincipal } from './accessTokenService';
import { LoginAttemptLimiter } from './loginAttemptLimiter';

export type CustomerDetails = Omit<Customer, 'customerPassword'>;
export type StaffDetails = Omit<Staff, 'staffPassword'>;
export type LoginAccount =
  | {
      principal: AuthPrincipal & { type: 'customer' };
      customer: CustomerDetails & { role: 'customer' };
    }
  | {
      principal: AuthPrincipal & { type: 'staff' };
      customer: StaffDetails & { role: string };
    };

export const INVALID_CREDENTIALS_MESSAGE = 'Your email or password is invalid';

export class InvalidCredentialsError extends Error {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE);
    this.name = 'InvalidCredentialsError';
  }
}

export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Too many login attempts. Please try again later.';

export class TooManyAttemptsError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(TOO_MANY_ATTEMPTS_MESSAGE);
    this.name = 'TooManyAttemptsError';
  }
}

type LoginRepositoryContract = Pick<
  LoginRepository,
  'findCustomerByEmail' | 'findStaffByEmail'
>;

// Verified when neither account type matches, so unknown emails take as long as wrong passwords.
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
  constructor(
    private readonly repository: LoginRepositoryContract,
    private readonly limiter = new LoginAttemptLimiter(),
  ) {}

  async login(
    email: string,
    password: string,
    clientId: string,
  ): Promise<LoginAccount> {
    const clientKey = `client:${clientId}`;
    const accountKey = `account:${email.toLowerCase()}`;

    const check = this.limiter.consume([clientKey, accountKey]);
    if (!check.allowed) {
      throw new TooManyAttemptsError(check.retryAfterSeconds);
    }

    const staff = await this.repository.findStaffByEmail(email);
    if (staff) {
      if (!(await verifyPassword(staff.staffPassword, password))) {
        throw new InvalidCredentialsError();
      }

      this.limiter.reset(accountKey);
      this.limiter.refund(clientKey, check.reservation);
      const { staffPassword: _staffPassword, ...details } = staff;
      return {
        principal: { type: 'staff', id: staff.staffID },
        customer: { ...details, role: staff.staffRole.toLowerCase() },
      };
    }

    const customer = await this.repository.findCustomerByEmail(email);

    if (!customer) {
      await verifyPassword(await DUMMY_HASH_PROMISE, password);
      throw new InvalidCredentialsError();
    }

    if (!(await verifyPassword(customer.customerPassword, password))) {
      throw new InvalidCredentialsError();
    }

    // Successful logins don't count towards either limit.
    this.limiter.reset(accountKey);
    this.limiter.refund(clientKey, check.reservation);

    const { customerPassword: _customerPassword, ...details } = customer;
    return {
      principal: { type: 'customer', id: details.customerID },
      customer: { ...details, role: 'customer' },
    };
  }
}
