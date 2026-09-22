import { defineConfig, devices } from "@playwright/test";

/**
 * README §12/§41: the two-browser-context acceptance test is the actual
 * definition of done, not a final-phase checkbox — written at Milestone
 * 3 and extended as each later milestone's slice of it becomes coverable
 * (e2e/ticket-realtime.spec.ts currently covers Tests 1, 2, 6 & 8).
 *
 * Requires a running dev server with real Postgres + Supabase Realtime
 * configured (DATABASE_URL, JWT_SECRET, NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — see
 * .env.example) and a seeded database (`npm run db:seed` — see
 * prisma/seed.ts for the demo password). None of that exists in the
 * sandbox this was written in, so this config and the spec file next to
 * it are correct-by-construction, not verified-by-execution — see this
 * session's notes on that limitation.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
