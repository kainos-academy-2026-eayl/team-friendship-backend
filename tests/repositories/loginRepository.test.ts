import { describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { LoginRepository } from '../../src/repositories/loginRepository';

describe('LoginRepository.findCustomerByEmail', () => {
  test('compares the literal email using the case-insensitive identity rule', async () => {
    const $queryRaw = vi.fn().mockResolvedValue([]);
    const repository = new LoginRepository({
      $queryRaw,
    } as unknown as PrismaClient);

    await repository.findCustomerByEmail('a_ice%\\@example.com');

    expect($queryRaw).toHaveBeenCalledOnce();
    const call = $queryRaw.mock.calls[0];
    if (!call) throw new Error('Expected a Prisma query');
    const [strings, ...values] = call;
    expect(strings.join('?')).toContain(
      'WHERE lower("customerEmail") = lower(?)',
    );
    expect(values).toEqual(['a_ice%\\@example.com']);
  });
});
