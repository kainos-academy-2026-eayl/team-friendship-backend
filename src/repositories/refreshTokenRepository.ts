import type { Prisma, PrismaClient } from '../generated/prisma/client';
import type { AuthPrincipal } from '../services/accessTokenService';

export type RotationResult =
  | { status: 'rotated'; principal: AuthPrincipal; expiresAt: Date }
  | { status: 'reused' }
  | { status: 'invalid' };

type Tx = Prisma.TransactionClient;

// Rotation, replay handling and logout all hold this lock, so a family-wide revoke can't miss a replacement inserted by a concurrent rotation.
async function lockFamily(tx: Tx, familyId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${familyId}, 0))`;
}

async function revokeAllInFamily(
  tx: Tx,
  familyId: string,
  now: Date,
): Promise<void> {
  await tx.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now },
  });
}

export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    tokenHash: string;
    principal: AuthPrincipal;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        customerID:
          data.principal.type === 'customer' ? data.principal.id : null,
        staffID: data.principal.type === 'staff' ? data.principal.id : null,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
      },
    });
  }

  rotate(oldHash: string, newHash: string, now: Date): Promise<RotationResult> {
    return this.prisma.$transaction(async (tx): Promise<RotationResult> => {
      const found = await tx.refreshToken.findUnique({
        where: { tokenHash: oldHash },
      });
      if (!found) {
        return { status: 'invalid' };
      }

      await lockFamily(tx, found.familyId);
      // Re-read under the lock: a concurrent rotation or revoke may have committed meanwhile.
      const current = await tx.refreshToken.findUniqueOrThrow({
        where: { id: found.id },
      });

      if (current.revokedAt) {
        await revokeAllInFamily(tx, current.familyId, now);
        return { status: 'reused' };
      }
      if (current.expiresAt <= now) {
        return { status: 'invalid' };
      }

      const principal =
        current.customerID !== null
          ? { type: 'customer' as const, id: current.customerID }
          : current.staffID !== null
            ? { type: 'staff' as const, id: current.staffID }
            : null;
      if (
        !principal ||
        (current.customerID !== null && current.staffID !== null)
      ) {
        await revokeAllInFamily(tx, current.familyId, now);
        return { status: 'invalid' };
      }

      const replacement = await tx.refreshToken.create({
        data: {
          tokenHash: newHash,
          customerID: current.customerID,
          staffID: current.staffID,
          familyId: current.familyId,
          expiresAt: current.expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: now, replacedById: replacement.id },
      });

      return {
        status: 'rotated',
        principal,
        expiresAt: current.expiresAt,
      };
    });
  }

  revokeFamily(tokenHash: string, now: Date): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash },
      });
      if (!token) return;
      await lockFamily(tx, token.familyId);
      await revokeAllInFamily(tx, token.familyId, now);
    });
  }
}
