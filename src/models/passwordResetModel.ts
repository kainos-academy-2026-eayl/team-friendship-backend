export interface PasswordResetRepository {
  createResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string | null>;
  resetPassword(
    email: string,
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean>;
}
