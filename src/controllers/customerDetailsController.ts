import argon2 from 'argon2';
import { type Response, Router } from 'express';
import { Prisma } from '../generated/prisma/client';
import { customerDetailsUpdateSchema } from '../models/customerDetailsModel';
import type { CustomerDetailsRepository } from '../repositories/customerDetailsRepository';
import { LoginAttemptLimiter } from '../services/loginAttemptLimiter';

function customerId(res: Response): number | undefined {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (principal.type !== 'customer') {
    res.status(403).json({ error: 'A customer account is required' });
    return;
  }
  return principal.id;
}

export function customerDetailsRouter(
  repository: Pick<
    CustomerDetailsRepository,
    'findById' | 'findPasswordById' | 'updateDetails'
  >,
  limiter = new LoginAttemptLimiter(),
): Router {
  const router = Router();
  router.use('/customers/me', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/customers/me', async (_req, res) => {
    const id = customerId(res);
    if (id === undefined) return;
    try {
      const customer = await repository.findById(id);
      if (!customer) {
        res.status(404).json({ error: 'Customer account not found' });
        return;
      }
      res.json({ customer });
    } catch (error) {
      console.error('Unable to load customer details', error);
      res.status(500).json({ error: 'Unable to load customer details' });
    }
  });
  router.patch('/customers/me', async (req, res) => {
    const id = customerId(res);
    if (id === undefined) return;
    const parsed = customerDetailsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid customer details.',
      });
      return;
    }
    const key = `customer-details:${id}`;
    const attempt = limiter.consume([key]);
    if (!attempt.allowed) {
      res.set('Retry-After', String(attempt.retryAfterSeconds));
      res
        .status(429)
        .json({ error: 'Too many password attempts. Please try again later.' });
      return;
    }
    try {
      const account = await repository.findPasswordById(id);
      if (!account) {
        res.status(404).json({ error: 'Customer account not found.' });
        return;
      }
      const { password, ...details } = parsed.data;
      if (!(await argon2.verify(account.customerPassword, password))) {
        res.status(403).json({
          error: 'Your current password is incorrect. No changes were saved.',
        });
        return;
      }
      if (
        !(await repository.updateDetails(id, account.customerPassword, details))
      ) {
        res.status(409).json({
          error: 'Your account changed. Please reload and try again.',
        });
        return;
      }
      limiter.refund(key, attempt.reservation);
      res.json({ message: 'Your details have been saved.' });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        res.status(409).json({
          error: 'That email address is already in use. No changes were saved.',
        });
        return;
      }
      console.error('Unable to save customer details', error);
      res.status(500).json({
        error: 'Unable to save your details. Please try again later.',
      });
    }
  });
  return router;
}
