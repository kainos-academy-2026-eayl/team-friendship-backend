import argon2 from 'argon2';
import { z } from 'zod';
import type {
  CustomerRecord,
  CustomerRepository,
  NewCustomer,
} from '../models/customerModel';

const registerCustomerSchema = z
  .object({
    customerForename: z.string().trim().min(1, 'Forename is required.'),
    customerSurname: z.string().trim().min(1, 'Surname is required.'),
    address: z.string().trim().min(1, 'Address is required.'),
    postcode: z.string().trim().min(1, 'Postcode is required.'),
    customerEmail: z
      .string()
      .trim()
      .pipe(z.email('Enter a valid email address.')),
    customerPhone: z.string().trim().min(1, 'Phone number is required.'),
    // Login rejects passwords over 128 characters, so registration must too.
    password: z
      .string()
      .min(1, 'Password is required.')
      .max(128, 'Password must be 128 characters or fewer.'),
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
      password,
      confirmPassword: _confirmPassword,
      ...customerDetails
    } = result.data;
    const customer: NewCustomer = {
      ...customerDetails,
      customerPassword: await argon2.hash(password),
    };

    return withoutPassword(await this.customerRepository.create(customer));
  }
}
