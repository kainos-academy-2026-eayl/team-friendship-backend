import { describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { LoginRepository } from '../../src/repositories/loginRepository';

describe('LoginRepository.findCustomerByEmail', () => {
  test('selects only the customer profile fields for the authenticated account', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      customerForename: 'Ada',
      customerSurname: 'Lovelace',
    });
    const repository = new LoginRepository({
      customer: { findUnique },
    } as unknown as PrismaClient);
    expect(
      await repository.findProfileByPrincipal({ type: 'customer', id: 42 }),
    ).toEqual({
      role: 'customer',
      firstName: 'Ada',
      surname: 'Lovelace',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { customerID: 42 },
      select: { customerForename: true, customerSurname: true },
    });
  });

  test('selects the staff name and normalises the database role', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      staffRole: 'ADMIN',
      staffForename: 'Grace',
      staffSurname: 'Hopper',
    });
    const repository = new LoginRepository({
      staff: { findUnique },
    } as unknown as PrismaClient);
    expect(
      await repository.findProfileByPrincipal({ type: 'staff', id: 7 }),
    ).toEqual({
      role: 'admin',
      firstName: 'Grace',
      surname: 'Hopper',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { staffID: 7 },
      select: { staffRole: true, staffForename: true, staffSurname: true },
    });
  });

  test('returns null for a deleted account', async () => {
    const repository = new LoginRepository({
      customer: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient);
    expect(
      await repository.findProfileByPrincipal({ type: 'customer', id: 42 }),
    ).toBeNull();
  });

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

  describe('LoginRepository.findStaffByEmail', () => {
    test('uses a case-insensitive parameterized email lookup', async () => {
      const $queryRaw = vi.fn().mockResolvedValue([]);
      const repository = new LoginRepository({
        $queryRaw,
      } as unknown as PrismaClient);

      await repository.findStaffByEmail('admin@example.com');

      expect($queryRaw).toHaveBeenCalledOnce();
      const call = $queryRaw.mock.calls[0];
      if (!call) throw new Error('Expected a Prisma query');
      const [strings, ...values] = call;
      expect(strings.join('?')).toContain(
        'WHERE lower("staffEmail") = lower(?)',
      );
      expect(values).toEqual(['admin@example.com']);
    });
  });
});
