export class BasketError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BasketError';
  }
}

export type BasketQuantityChange = { quantity: number } | { change: -1 | 1 };
