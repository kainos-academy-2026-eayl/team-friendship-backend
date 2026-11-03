import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { PasswordResetRepository } from '../models/passwordResetModel';
import { PasswordResetService } from '../services/passwordResetService';

const resetRequestSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  token: z.string().min(1),
  password: z.string().min(1).max(128),
});

export function resetPassword(
  repository: PasswordResetRepository,
): RequestHandler {
  const service = new PasswordResetService(repository);

  return async (req, res, next) => {
    const result = resetRequestSchema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid reset password request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    try {
      const updated = await service.resetPassword(
        result.data.email,
        result.data.token,
        result.data.password,
      );
      if (!updated) {
        res.status(400).json({ error: 'Invalid or expired reset link' });
        return;
      }

      res.status(200).json({ message: 'Password reset successfully.' });
    } catch (error) {
      next(error);
    }
  };
}
