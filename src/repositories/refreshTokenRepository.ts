import type { PrismaClient } from '../generated/prisma/client';

export type RotationResult =
  | { status: 'rotated'; customerId: number; expiresAt: Date }
  | { status: 'reused' }
  | { status: 'invalid' };

export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    tokenHash: string;
    customerId: number;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        customerID: data.customerId,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
      },
    });
  }

  rotate(oldHash: string, newHash: string, now: Date): Promise<RotationResult> {
    return this.prisma.$transaction(async (tx): Promise<RotationResult> => {
      // The revokedAt condition makes this a compare-and-swap, so concurrent refreshes can't both succeed.
      const consumed = await tx.refreshToken.updateMany({
        where: { tokenHash: oldHash, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });

      if (consumed.count === 0) {
        const existing = await tx.refreshToken.findUnique({
          where: { tokenHash: oldHash },
        });
        if (existing?.revokedAt) {
          await tx.refreshToken.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
          return { status: 'reused' };
        }
        return { status: 'invalid' };
      }

      const current = await tx.refreshToken.findUniqueOrThrow({
        where: { tokenHash: oldHash },
      });
      const replacement = await tx.refreshToken.create({
        data: {
          tokenHash: newHash,
          customerID: current.customerID,
          familyId: current.familyId,
          expiresAt: current.expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { replacedById: replacement.id },
      });

      return {
        status: 'rotated',
        customerId: current.customerID,
        expiresAt: current.expiresAt,
      };
    });
  }

  async revokeFamily(tokenHash: string, now: Date): Promise<void> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!token) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: token.familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
