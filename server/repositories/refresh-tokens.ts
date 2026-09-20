import { prisma } from "@/lib/prisma";

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

/** Sign-out-everywhere path — not wired to any UI yet, but the repository
 *  layer should have it ready for when it is (e.g. a "sign out all
 *  devices" account action). */
export async function revokeAllRefreshTokensForUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
