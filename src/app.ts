import express, { type Express, type Request, type Response } from 'express';
import { registerCustomer } from './controllers/customerController';
import {
  type CustomerRepository,
  PrismaCustomerRepository,
} from './repositories/customerRepository';

export function createApp(
  customerRepository: CustomerRepository = new PrismaCustomerRepository(),
): Express {
  const app = express();

  app.use(express.json());
  app.post('/register', registerCustomer(customerRepository));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}
