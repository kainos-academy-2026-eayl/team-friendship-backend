import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { registerCustomer } from './controllers/customerController';
import type { CustomerRepository } from './models/customerModel';
import { PrismaCustomerRepository } from './repositories/customerRepository';

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:8000';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({ origin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN }),
  );
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}
