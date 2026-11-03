import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { PasswordResetRepository } from '../models/passwordResetModel';

const RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class PasswordResetService {
  constructor(private readonly repository: PasswordResetRepository) {}

  async requestReset(email: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_LIFETIME_MS);
    const customerEmail = await this.repository.createResetToken(
      email,
      hashResetToken(token),
      expiresAt,
    );

    return customerEmail ? { email: customerEmail, token } : null;
  }

  async resetPassword(email: string, token: string, password: string) {
    const passwordHash = await argon2.hash(password);
    return this.repository.resetPassword(
      email,
      hashResetToken(token),
      passwordHash,
      new Date(),
    );
  }
}
