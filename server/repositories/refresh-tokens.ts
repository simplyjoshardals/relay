import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function createRefreshToken(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.refreshToken.create({ data: params });
}

/** A refresh token is valid if its hash matches, it hasn't expired, and
 *  it hasn't been revoked — either because it was already redeemed once
 *  (§4's single-use rotation) or because the user signed out. */
export async function findValidRefreshToken(tokenHash: string) {
  return prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
  });
}

export async function revokeRefreshToken(id: string) {
  await prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/** Sign-out-everywhere path. First caller is Milestone 10's
 *  `deactivateMember` (server/application/users.ts), which passes its
 *  transaction's client so the revocation commits or rolls back together
 *  with the deactivation itself; other callers omit `db`. */
export async function revokeAllRefreshTokensForUser(
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
