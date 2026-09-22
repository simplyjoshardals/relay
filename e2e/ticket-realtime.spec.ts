import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { updateServiceTelemetry } from "@/server/application/services";

/**
 * §41's actual definition of done — all eight tests now covered: 1, 2
 * (ticket creation and assignment), 3, 4, 5, 7 (incident creation,
 * ticket-linked impact, response assignment, and recovery — added here
 * as Milestone 5 made them coverable, per §12's instruction to keep this
 * file red rather than write eight tests up front against features that
 * don't exist yet), 6 (service degradation), and 8 (disconnect /
 * reconnect / reconcile) — every one propagating between two browser
 * contexts with no reload.
 *
 * Password must match prisma/seed.ts's DEMO_PASSWORD — there's no
 * shared import between the seed script and this test file, so if one
 * changes, the other needs to change too. Tests 6 and 7 below duplicate
 * PAYMENTS_SERVICE_ID for the same reason.
 *
 * Playwright Test resolves tsconfig `paths` for spec files itself, so
 * Test 6/7's `@/*` import of the application layer needs no
 * relative-path workaround. That's a separate concern from env loading,
 * though: like workers/telemetry.ts, this file is a standalone Node
 * process pulling in `/server/application` directly rather than going
 * through Next.js (which loads `.env` on its own) — the new
 * `prisma-client` generator doesn't load `.env` at runtime, so the
 * explicit `import "dotenv/config"` above is required for
 * `@/lib/prisma`'s `process.env.DATABASE_URL` to be defined when Test
 * 6/7 run.
 */
const DEMO_PASSWORD = "relay-dev-1234";

const USER_A = { email: "maya@kestrel.dev", name: "Maya Reyes" };
const USER_B = { email: "josh@kestrel.dev", name: "Josh Dietrich" };

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("§41 Test 1 & 2 — ticket creation and assignment propagate live", () => {
  test("a ticket created by one user appears for another without a reload", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, USER_A.email);
    await loginAs(pageB, USER_B.email);

    await pageA.goto("/tickets");
    await pageB.goto("/tickets");

    const title = `Realtime test ticket ${Date.now()}`;

    // Test 1 (§41): create in Browser A.
    await pageA.getByRole("button", { name: "New ticket" }).click();
    await pageA.getByLabel("Title").fill(title);
    await pageA.getByRole("button", { name: "Create ticket" }).click();

    // Check Browser A first — this does NOT depend on realtime at all
    // (its own mutation invalidates its own query on success), so a
    // failure here means ticket creation itself is broken, not
    // propagation. Splitting this out turns "Browser B never sees it"
    // from one failure into two, so a red run actually points at which
    // half is broken instead of leaving both as suspects.
    await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });

    // The real assertion: Browser B never reloads or navigates. If this
    // only passes after a manual pageB.reload(), the realtime wiring
    // (broadcast → RLS-authorized subscription → invalidateQueries)
    // isn't actually working — a passing test with a reload added would
    // be testing the wrong thing.
    await expect(pageB.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Test 2 (§41): assign it to Browser B's user, from Browser A.
    await pageA.getByText(title).click();
    await pageA.getByLabel("Assignee").selectOption({ label: USER_B.name });
    await pageA.getByRole("button", { name: "Save changes" }).click();

    // Same split as Test 1: confirm the update itself succeeded on
    // Browser A before blaming propagation. TicketsView's
    // updateMutation.onSuccess only shows this toast (and closes the
    // modal) on the ok:true branch — a ConflictError/ValidationError/
    // NotFoundError from updateTicket() surfaces as an error toast
    // instead and never reaches broadcastToOrg(), which would make
    // Browser B's failure below a red herring pointing at realtime when
    // the actual bug is in the mutation itself.
    await expect(pageA.getByText("Ticket updated")).toBeVisible({
      timeout: 10_000,
    });

    // The modal closing is the same signal from a different angle —
    // onSuccess's ok:true branch is also what calls setModalState(null).
    await expect(
      pageA.getByRole("heading", { name: "Edit ticket" }),
    ).toBeHidden({ timeout: 5_000 });

    // Browser B should see itself assigned without any reload either —
    // the avatar/assignment indicator replacing "Assign to me" on that
    // row is the visible signal.
    const rowB = pageB.locator("li", { hasText: title });
    await expect(rowB.getByTitle(USER_B.name)).toBeVisible({
      timeout: 10_000,
    });

    await contextA.close();
    await contextB.close();
  });
});

test.describe("§41 Test 3, 4 & 5 — incident creation, ticket-linked impact, and response propagate live", () => {
  test("an incident, its linked tickets, and its responder all appear for another browser without a reload", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, USER_A.email);
    await loginAs(pageB, USER_B.email);

    // Test 4 ("associate multiple tickets with the incident") needs
    // real tickets to link against — IncidentModal's checklist lists
    // actual org tickets (Milestone 5), not placeholder rows, so two
    // get created here first.
    const ts = Date.now();
    const ticketATitle = `Impact test ticket A ${ts}`;
    const ticketBTitle = `Impact test ticket B ${ts}`;

    await pageA.goto("/tickets");
    for (const title of [ticketATitle, ticketBTitle]) {
      await pageA.getByRole("button", { name: "New ticket" }).click();
      await pageA.getByLabel("Title").fill(title);
      await pageA.getByRole("button", { name: "Create ticket" }).click();
      await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });
    }

    await pageA.goto("/incidents");
    await pageB.goto("/incidents");

    // Test 3 (§41): create an incident affecting a service, from
    // Browser A.
    const incidentTitle = `Realtime test incident ${ts}`;

    await pageA.getByRole("button", { name: "New incident" }).click();
    await pageA.getByLabel("Title").fill(incidentTitle);
    // Seeded by prisma/seed.ts — same service Test 6 below exercises.
    await pageA.getByRole("checkbox", { name: "Payments API" }).check();
    await pageA.getByRole("checkbox", { name: ticketATitle }).check();
    await pageA.getByRole("checkbox", { name: ticketBTitle }).check();
    await pageA.getByRole("button", { name: "Create incident" }).click();

    // Same split as Test 1: confirm the create itself succeeded on
    // Browser A before blaming propagation.
    await expect(pageA.getByText(incidentTitle)).toBeVisible({
      timeout: 10_000,
    });

    // The real assertion for Test 3: Browser B never reloads or
    // navigates.
    await expect(pageB.getByText(incidentTitle)).toBeVisible({
      timeout: 10_000,
    });

    // Test 4 (§41): "the incident displays its operational impact" —
    // both linked tickets showing up as a count on the row, on both
    // browsers.
    const rowA = pageA.locator("li", { hasText: incidentTitle });
    const rowB = pageB.locator("li", { hasText: incidentTitle });
    await expect(rowA.getByText("2 tickets")).toBeVisible({
      timeout: 10_000,
    });
    await expect(rowB.getByText("2 tickets")).toBeVisible({
      timeout: 10_000,
    });

    // Test 5 (§41): assign the incident to Browser B's user, from
    // Browser A.
    await pageA.getByText(incidentTitle).click();
    await pageA.getByLabel("Responder").selectOption({ label: USER_B.name });
    await pageA.getByRole("button", { name: "Save changes" }).click();

    // Confirm the update itself succeeded on Browser A first, same
    // reasoning as Test 2 above — a rejected update never reaches
    // broadcastToOrg(), which would make Browser B's check below a
    // red herring pointing at realtime when the actual bug is in the
    // mutation itself.
    await expect(pageA.getByText("Incident updated")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      pageA.getByRole("heading", { name: "Edit incident" }),
    ).toBeHidden({ timeout: 5_000 });

    // "A sees B as the responder immediately" (§41 Test 5) is the
    // named assertion, but B seeing itself reflected back without a
    // reload is the same realtime path and worth checking too.
    await expect(rowA.getByTitle(`${USER_B.name} responding`)).toBeVisible({
      timeout: 10_000,
    });
    await expect(rowB.getByTitle(`${USER_B.name} responding`)).toBeVisible({
      timeout: 10_000,
    });

    await contextA.close();
    await contextB.close();
  });
});

test.describe("§41 Test 6 — service degradation propagates live", () => {
  test("a degraded reading is visible on both dashboards without a reload", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, USER_A.email);
    await loginAs(pageB, USER_B.email);

    await pageA.goto("/services");
    await pageB.goto("/services");

    const cardA = pageA.getByTestId("service-card-Payments API");
    const cardB = pageB.getByTestId("service-card-Payments API");

    // Both start OPERATIONAL — prisma/seed.ts's create default, assuming
    // nothing else in this run already degraded it. Asserted first so a
    // failure below can't be misread as "was already degraded."
    await expect(cardA.getByText("Operational")).toBeVisible({
      timeout: 10_000,
    });
    await expect(cardB.getByText("Operational")).toBeVisible({
      timeout: 10_000,
    });

    // The simulation itself. There's no UI affordance for this —
    // status/latency/errorRate are deliberately telemetry-only (README
    // §13, ServiceModal.tsx's doc comment), never a field a human
    // submits through a form. The real telemetry worker
    // (workers/telemetry.ts) would eventually produce a DEGRADED
    // reading through its own random walk, but "eventually, randomly,
    // on a ~4s tick with a 6% spike chance" isn't reliable to await in
    // a test — so this calls the exact same application-layer function
    // the worker calls on the tick where it decides a reading is
    // degraded (same version-checked write, same Activity row, same
    // broadcastToOrg() call), just invoked directly and deterministically
    // rather than waiting on the worker's own timer. This is standing in
    // for one worker tick, not bypassing the architecture Test 6 is
    // meant to exercise.
    const PAYMENTS_SERVICE_ID = "00000000-0000-0000-0000-000000000101";
    const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

    await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
      latencyMs: 420,
      errorRate: 3.8,
      status: "DEGRADED",
    });

    // Neither browser reloads or navigates from here. §7's debounce
    // (RealtimeProvider.tsx) allows up to ~1.5s before the invalidation
    // fires, on top of ordinary network/render time.
    await expect(cardA.getByText("Degraded")).toBeVisible({
      timeout: 10_000,
    });
    await expect(cardB.getByText("Degraded")).toBeVisible({
      timeout: 10_000,
    });

    // Restore the seed row to OPERATIONAL so a re-run of this test (or
    // the real telemetry worker's next tick, if it's running) doesn't
    // inherit a DEGRADED starting point.
    await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
      latencyMs: 110,
      errorRate: 0.3,
      status: "OPERATIONAL",
    });

    await contextA.close();
    await contextB.close();
  });
});

test.describe("§41 Test 7 — recovery: service restore and incident resolution converge", () => {
  test("both browsers converge on Operational/Resolved without a reload", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, USER_A.email);
    await loginAs(pageB, USER_B.email);
    await pageA.goto("/incidents");
    await pageB.goto("/incidents");

    // A fresh incident for this test rather than reusing Test 3/4/5's
    // (a separate Playwright test file/run has no ordering guarantee
    // against it) — affecting the same seeded service Test 6 degrades,
    // so restoring that service below is the same "the affected
    // service" §41 Test 7 describes, not an unrelated one.
    const PAYMENTS_SERVICE_ID = "00000000-0000-0000-0000-000000000101";
    const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";
    const incidentTitle = `Recovery test incident ${Date.now()}`;

    await pageA.getByRole("button", { name: "New incident" }).click();
    await pageA.getByLabel("Title").fill(incidentTitle);
    await pageA.getByRole("checkbox", { name: "Payments API" }).check();
    await pageA.getByRole("button", { name: "Create incident" }).click();
    await expect(pageA.getByText(incidentTitle)).toBeVisible({
      timeout: 10_000,
    });
    await expect(pageB.getByText(incidentTitle)).toBeVisible({
      timeout: 10_000,
    });

    // The service side of "recovery" — same standing-in-for-a-worker-
    // tick reasoning Test 6 documents: degrade first (an incident
    // affecting an already-healthy service wouldn't be much of a
    // recovery to observe), then restore.
    await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
      latencyMs: 420,
      errorRate: 3.8,
      status: "DEGRADED",
    });
    await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
      latencyMs: 110,
      errorRate: 0.3,
      status: "OPERATIONAL",
    });

    // The incident side: resolve it from Browser A.
    await pageA.getByText(incidentTitle).click();
    await pageA.getByLabel("Status").selectOption({ label: "Resolved" });
    await pageA.getByRole("button", { name: "Save changes" }).click();
    await expect(pageA.getByText("Incident updated")).toBeVisible({
      timeout: 10_000,
    });

    // "Both clients converge on the same final state" (§41 Test 7):
    // neither browser reloads, and both end up showing the incident
    // as Resolved.
    // Exact match: the row also shows "Resolved 5s ago" as a separate
    // element (incident.resolvedAt's relative time), which also
    // contains the substring "Resolved" and would otherwise make this
    // locator resolve to two elements.
    const rowA = pageA.locator("li", { hasText: incidentTitle });
    const rowB = pageB.locator("li", { hasText: incidentTitle });
    await expect(rowA.getByText("Resolved", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(rowB.getByText("Resolved", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await contextA.close();
    await contextB.close();
  });
});

test.describe("§41 Test 8 — disconnect, then reconnect and reconcile", () => {
  test("shows a clear connection-lost state, then reconciles on reconnect", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, USER_A.email);
    await loginAs(pageB, USER_B.email);
    await pageA.goto("/tickets");
    await pageB.goto("/tickets");

    // Browser B starts live.
    await expect(
      pageB.getByRole("status").filter({ hasText: "Live" }),
    ).toBeVisible({ timeout: 15_000 });

    // "Kill the network connection" (§41 Test 8) on Browser B only.
    await contextB.setOffline(true);

    // A clear connection-lost state: the indicator flips and the page
    // says its data may be stale. This is driven by the browser's
    // 'offline' event, so it holds even though Playwright's offline
    // emulation doesn't reliably sever an already-open WebSocket.
    await expect(
      pageB.getByRole("status").filter({ hasText: "Offline" }),
    ).toBeVisible({ timeout: 5_000 });
    // Filtered by text: Next.js's own route announcer is also
    // role="alert" on every page, so a bare getByRole("alert") matches
    // two elements and trips Playwright's strict mode.
    const staleBanner = pageB
      .getByRole("alert")
      .filter({ hasText: "out of date" });
    await expect(staleBanner).toBeVisible();

    // Meanwhile Browser A (still online) makes a change B can't have
    // received through a healthy connection.
    const title = `Reconnect test ticket ${Date.now()}`;
    await pageA.getByRole("button", { name: "New ticket" }).click();
    await pageA.getByLabel("Title").fill(title);
    await pageA.getByRole("button", { name: "Create ticket" }).click();
    await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Restore the connection. B must reconnect on its own — no reload —
    // return to Live, drop the warning, and reconcile with server state
    // (§35: invalidate everything on SUBSCRIBED), which is where the
    // ticket created during the outage shows up.
    await contextB.setOffline(false);

    await expect(
      pageB.getByRole("status").filter({ hasText: "Live" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(staleBanner).toBeHidden();
    await expect(pageB.getByText(title)).toBeVisible({ timeout: 10_000 });

    await contextA.close();
    await contextB.close();
  });
});
