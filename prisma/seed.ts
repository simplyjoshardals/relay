import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../server/auth/password";

// Relative imports throughout this file rather than the `@/*` alias —
// the seed runner (tsx, via prisma7.config.ts) isn't guaranteed to
// respect tsconfig path aliases the way Next's own build does, so this
// avoids depending on that.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// A fixed, known UUID (rather than a generated one) so this seed is
// idempotent — re-running it upserts the same org instead of creating a
// duplicate every time.
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Every seeded user shares this password — dev/demo only, printed below
// so it's obvious at seed time, never meant for anything real.
const DEMO_PASSWORD = "relay-dev-1234";

// Same identities mock-data.ts has always used (lib/mock-data.ts), so
// switching a page from mock data to a real query returns someone the
// UI already has copy/avatars/etc. built around.
const seedUsers = [
  { email: "maya@kestrel.dev", name: "Maya Reyes", role: "MANAGER" as const },
  { email: "josh@kestrel.dev", name: "Josh Dietrich", role: "MEMBER" as const },
  { email: "sana@kestrel.dev", name: "Sana Kapoor", role: "MEMBER" as const },
  { email: "leo@kestrel.dev", name: "Leo Fontaine", role: "MEMBER" as const },
  { email: "priya@kestrel.dev", name: "Priya Nair", role: "MEMBER" as const },
];

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: SEED_ORG_ID },
    update: {},
    create: { id: SEED_ORG_ID, name: "Kestrel Commerce" },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { orgId_email: { orgId: org.id, email: user.email } },
      update: {},
      create: { ...user, orgId: org.id, passwordHash },
    });
  }

  console.log(`Seeded ${seedUsers.length} users in "${org.name}".`);
  console.log(`Every seeded user's password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
