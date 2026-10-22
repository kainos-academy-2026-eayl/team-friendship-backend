export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = { count: number; resetAt: number };

export type AttemptCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptRecord>();
  private lastSweep = 0;

  constructor(
    private readonly maxAttempts = MAX_LOGIN_ATTEMPTS,
    private readonly windowMs = LOGIN_ATTEMPT_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Records an attempt against every key if none of them are over the limit.
   * Runs synchronously so concurrent requests cannot all slip past the check.
   */
  consume(keys: readonly string[]): AttemptCheck {
    const now = this.now();
    this.sweep(now);

    let retryAfterMs = 0;
    for (const key of keys) {
      const record = this.activeRecord(key, now);
      if (record && record.count >= this.maxAttempts) {
        retryAfterMs = Math.max(retryAfterMs, record.resetAt - now);
      }
    }
    if (retryAfterMs > 0) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    for (const key of keys) {
      const record = this.activeRecord(key, now);
      if (record) {
        record.count += 1;
      } else {
        this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      }
    }
    return { allowed: true };
  }

  /** Gives back one attempt, e.g. after a successful login. */
  refund(key: string): void {
    const record = this.activeRecord(key, this.now());
    if (!record) return;
    record.count -= 1;
    if (record.count <= 0) this.attempts.delete(key);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private activeRecord(key: string, now: number): AttemptRecord | undefined {
    const record = this.attempts.get(key);
    if (record && record.resetAt <= now) {
      this.attempts.delete(key);
      return undefined;
    }
    return record;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [key, record] of this.attempts) {
      if (record.resetAt <= now) this.attempts.delete(key);
    }
  }
}
