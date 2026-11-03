import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { registerCustomer } from './controllers/customerController';
import { forgotPassword } from './controllers/forgotPasswordController';
import { resetPassword } from './controllers/resetPasswordController';
import type { CustomerRepository } from './models/customerModel';
import type { PasswordResetRepository } from './models/passwordResetModel';
import {
  PrismaCustomerRepository,
  PrismaPasswordResetRepository,
} from './repositories/customerRepository';

const DEFAULT_FRONTEND_ORIGINS = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://0.0.0.0:8000',
];

function frontendOrigins(): string[] {
  const configured = process.env.FRONTEND_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_FRONTEND_ORIGINS;
}

export function createApp(
  customerRepository: CustomerRepository = new PrismaCustomerRepository(),
  passwordResetRepository: PasswordResetRepository = new PrismaPasswordResetRepository(),
): Express {
  const app = express();

  app.use(cors({ origin: frontendOrigins() }));
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.post('/register', registerCustomer(customerRepository));
  app.post('/forgot-password', forgotPassword(passwordResetRepository));
  app.post('/reset-password', resetPassword(passwordResetRepository));

  // Order endpoints - only create if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    try {
      const orderRepository = new OrderRepository(getPrismaClient());
      const orderService = new OrderServiceImpl(orderRepository);
      const orderController = new OrderController(orderService);
      app.use(orderController.router());
    } catch (_error) {
      // If order endpoints fail to initialize, continue without them
      // This allows tests to run without DATABASE_URL
    }
  }

  return app;
}
