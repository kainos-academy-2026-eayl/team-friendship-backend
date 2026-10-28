import type { RequestHandler } from 'express';
import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .pipe(z.email({ error: 'Please enter a valid email address' })),
});

export const forgotPassword: RequestHandler = (req, res) => {
  const result = forgotPasswordSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({
      error: 'Invalid forgot password request',
      details: z.flattenError(result.error).fieldErrors,
    });
    return;
  }

  res.status(501).json({ error: 'Password recovery is not available yet.' });
};
