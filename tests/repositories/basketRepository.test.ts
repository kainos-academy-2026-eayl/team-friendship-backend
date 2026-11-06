import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client';
import { BasketRepository } from '../../src/repositories/basketRepository';

const row = { basketID: 1, customerID: 7, productID: 12, quantity: 2 };
const tx = {
  $queryRaw: vi.fn(),
  basket: {
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
const transaction = vi.fn(
  async (run: (client: Prisma.TransactionClient) => Promise<unknown>) =>
    run(tx as unknown as Prisma.TransactionClient),
);
const repository = new BasketRepository({
  $transaction: transaction,
} as unknown as PrismaClient);

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ productStock: 5 }]);
  tx.basket.findFirst.mockResolvedValue(row);
  tx.basket.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });
  tx.basket.create.mockResolvedValue(row);
  tx.basket.update.mockResolvedValue(row);
});

describe('transactional basket stock checks', () => {
  it('adds up to the exact stock limit and locks the database product first', async () => {
    await repository.addItem(7, 12, 3);
    expect(tx.$queryRaw.mock.calls[0]?.[0].join('')).toContain('FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0]?.[1]).toBe(12);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.basket.aggregate.mock.invocationCallOrder[0] ?? 0,
    );
    expect(tx.basket.aggregate).toHaveBeenCalledWith({
      where: { customerID: 7, productID: 12 },
      _sum: { quantity: true },
    });
    expect(tx.basket.create).toHaveBeenCalledWith({
      data: { customerID: 7, productID: 12, quantity: 3 },
    });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('rejects additions above the combined basket limit', async () => {
    await expect(repository.addItem(7, 12, 4)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.basket.create).not.toHaveBeenCalled();
  });

  it('rejects zero-stock products', async () => {
    tx.$queryRaw.mockResolvedValue([{ productStock: 0 }]);
    await expect(repository.addItem(7, 12, 1)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.basket.create).not.toHaveBeenCalled();
  });

  it('rejects missing products', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(repository.addItem(7, 12, 1)).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.basket.create).not.toHaveBeenCalled();
  });

  it('increments to the stock limit using the latest locked basket quantity', async () => {
    tx.basket.findFirst
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, quantity: 4 });
    tx.basket.aggregate.mockResolvedValue({ _sum: { quantity: 4 } });
    await repository.updateQuantity(7, 1, { change: 1 });
    expect(tx.basket.update).toHaveBeenCalledWith({
      where: { basketID: 1 },
      data: { quantity: 5 },
    });
  });

  it.each([{ change: 1 as const }, { quantity: 3 }])(
    'rejects an increase when other rows use the remaining stock: %j',
    async (input) => {
      tx.basket.aggregate.mockResolvedValue({ _sum: { quantity: 5 } });
      await expect(
        repository.updateQuantity(7, 1, input),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.basket.update).not.toHaveBeenCalled();
    },
  );

  it('still permits a reduction after stock falls to zero', async () => {
    tx.$queryRaw.mockResolvedValue([{ productStock: 0 }]);
    await repository.updateQuantity(7, 1, { change: -1 });
    expect(tx.basket.update).toHaveBeenCalledWith({
      where: { basketID: 1 },
      data: { quantity: 1 },
    });
  });

  it('does not reduce below one', async () => {
    tx.basket.findFirst.mockResolvedValue({ ...row, quantity: 1 });
    await expect(
      repository.updateQuantity(7, 1, { change: -1 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.basket.update).not.toHaveBeenCalled();
  });

  it('scopes updates to the authenticated customer', async () => {
    tx.basket.findFirst.mockResolvedValue(null);
    await expect(
      repository.updateQuantity(9, 1, { change: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.basket.findFirst).toHaveBeenCalledWith({
      where: { customerID: 9, basketID: 1 },
    });
    expect(tx.basket.update).not.toHaveBeenCalled();
  });
});
