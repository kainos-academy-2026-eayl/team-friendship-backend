import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { z } from 'zod';
import type {
  CustomerRecord,
  CustomerRepository,
  NewCustomer,
} from '../repositories/customerRepository';

const registerCustomerSchema = z
  .object({
    customerForename: z.string().trim().min(1, 'Forename is required.'),
    customerSurname: z.string().trim().min(1, 'Surname is required.'),
    address: z.string().trim().min(1, 'Address is required.'),
    postcode: z.string().trim().min(1, 'Postcode is required.'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters.')
      .email('Enter a valid email address.'),
    customerPhone: z.string().trim().min(1, 'Phone number is required.'),
    password: z.string().min(1, 'Password is required.'),
    confirmPassword: z.string().min(1, 'Password confirmation is required.'),
  })
  .superRefine((customer, context) => {
    if (customer.password !== customer.confirmPassword) {
      context.addIssue({
        code: 'custom',
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
      });
    }
  });

export class RegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationValidationError';
  }
}

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

function withoutPassword(customer: CustomerRecord) {
  const { customerPassword: _customerPassword, ...publicCustomer } = customer;
  return publicCustomer;
}

export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async register(input: unknown) {
    const result = registerCustomerSchema.safeParse(input);
    if (!result.success) {
      throw new RegistrationValidationError(
        result.error.issues[0]?.message ?? 'Invalid registration details.',
      );
    }

    const {
      username,
      password,
      confirmPassword: _confirmPassword,
      ...customerDetails
    } = result.data;
    const customer: NewCustomer = {
      ...customerDetails,
      customerEmail: username,
      customerPassword: await hashPassword(password),
    };

    return withoutPassword(await this.customerRepository.create(customer));
  }
}
