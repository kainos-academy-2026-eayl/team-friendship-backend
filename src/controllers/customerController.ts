import type { RequestHandler } from 'express';
import {
  type CustomerRepository,
  DuplicateCustomerEmailError,
} from '../repositories/customerRepository';
import {
  CustomerService,
  RegistrationValidationError,
} from '../services/customerService';

export function registerCustomer(
  customerRepository: CustomerRepository,
): RequestHandler {
  const customerService = new CustomerService(customerRepository);

  return async (req, res, next) => {
    try {
      const customer = await customerService.register(req.body);
      res
        .status(201)
        .json({ message: 'Account created successfully.', customer });
    } catch (error) {
      if (
        error instanceof RegistrationValidationError ||
        error instanceof DuplicateCustomerEmailError
      ) {
        res
          .status(error instanceof DuplicateCustomerEmailError ? 409 : 400)
          .json({ message: error.message });
        return;
      }

      next(error);
    }
  };
}
