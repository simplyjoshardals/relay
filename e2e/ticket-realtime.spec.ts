import { test, expect, type Page } from "@playwright/test";

/**
 * §41's actual definition of done — this file currently covers only
 * this milestone's slice (Tests 1 & 2: ticket creation and assignment
 * propagating between two browser contexts with no reload). Tests 3–8
 * get added here as Milestones 4/5/8 make them coverable, per §12's
 * instruction to keep this file red rather than write eight tests up
 * front against features that don't exist yet.
 *
 * Password must match prisma/seed.ts's DEMO_PASSWORD — there's no
 * shared import between the seed script and this test file, so if one
 * changes, the other needs to change too.
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