import { describe, expect, test, vi } from 'vitest';
import type { Customer, PrismaClient } from '../../src/generated/prisma/client';
import { LoginRepository } from '../../src/repositories/loginRepository';

describe('LoginRepository.findCustomerByEmail', () => {
  test('looks up the customer by the unique case-insensitive email identity', async () => {
    const customer = { customerEmail: 'ada@example.com' } as Customer;
    const findUnique = vi.fn().mockResolvedValue(customer);
    const prisma = {
      customer: { findUnique },
    } as unknown as PrismaClient;
    const repository = new LoginRepository(prisma);

    await expect(
      repository.findCustomerByEmail('ADA@example.com'),
    ).resolves.toBe(customer);
    expect(findUnique).toHaveBeenCalledWith({
      where: { customerEmail: 'ADA@example.com' },
    });
  });
});
