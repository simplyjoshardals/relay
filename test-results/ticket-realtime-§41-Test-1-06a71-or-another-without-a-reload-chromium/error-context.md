# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ticket-realtime.spec.ts >> §41 Test 1 & 2 — ticket creation and assignment propagate live >> a ticket created by one user appears for another without a reload
- Location: e2e\ticket-realtime.spec.ts:29:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('li').filter({ hasText: 'Realtime test ticket 1789951300045' }).getByTitle('Josh Dietrich')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('li').filter({ hasText: 'Realtime test ticket 1789951300045' }).getByTitle('Josh Dietrich') with timeout 10000ms
  - waiting for locator('li').filter({ hasText: 'Realtime test ticket 1789951300045' }).getByTitle('Josh Dietrich')

```

```yaml
- banner:
  - img "Logo"
  - text: Kestrel Commerce
  - navigation:
    - link "Dashboard":
      - /url: /dashboard
    - link "Tickets":
      - /url: /tickets
    - link "Incidents":
      - /url: /incidents
    - link "Services":
      - /url: /services
    - link "Activity":
      - /url: /activity
  - text: Live JD
  - button "Sign out":
    - img
- main:
  - heading "Tickets" [level=1]
  - paragraph: 4 tickets
  - button "New ticket":
    - img
    - text: New ticket
  - button "All 4"
  - button "Open 4"
  - button "In progress 0"
  - button "Blocked 0"
  - button "Resolved 0"
  - img
  - textbox "Search tickets"
  - list:
    - button "Medium priority Realtime test ticket 1789951300045 Open just now Assign to me":
      - text: Realtime test ticket 1789951300045 Open just now
      - button "Assign to me"
    - button "Medium priority Realtime test ticket 1789948424186 Open 48m ago Assign to me":
      - text: Realtime test ticket 1789948424186 Open 48m ago
      - button "Assign to me"
    - button "Medium priority Realtime test ticket 1789948132017 Open 49m ago Assign to me":
      - text: Realtime test ticket 1789948132017 Open 49m ago
      - button "Assign to me"
    - button "Medium priority Resolve intermittent 502 Bad Gateway errors on the user checkout API Open 6h ago Assign to me":
      - text: Resolve intermittent 502 Bad Gateway errors on the user checkout API Open 6h ago
      - button "Assign to me"
- button "Open Tanstack query devtools":
  - img
- alert
```

# Test source

```ts
  1  | import { test, expect, type Page } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * §41's actual definition of done — this file currently covers only
  5  |  * this milestone's slice (Tests 1 & 2: ticket creation and assignment
  6  |  * propagating between two browser contexts with no reload). Tests 3–8
  7  |  * get added here as Milestones 4/5/8 make them coverable, per §12's
  8  |  * instruction to keep this file red rather than write eight tests up
  9  |  * front against features that don't exist yet.
  10 |  *
  11 |  * Password must match prisma/seed.ts's DEMO_PASSWORD — there's no
  12 |  * shared import between the seed script and this test file, so if one
  13 |  * changes, the other needs to change too.
  14 |  */
  15 | const DEMO_PASSWORD = "relay-dev-1234";
  16 | 
  17 | const USER_A = { email: "maya@kestrel.dev", name: "Maya Reyes" };
  18 | const USER_B = { email: "josh@kestrel.dev", name: "Josh Dietrich" };
  19 | 
  20 | async function loginAs(page: Page, email: string) {
  21 |   await page.goto("/login");
  22 |   await page.getByLabel("Email").fill(email);
  23 |   await page.getByLabel("Password").fill(DEMO_PASSWORD);
  24 |   await page.getByRole("button", { name: "Sign in" }).click();
  25 |   await expect(page).toHaveURL(/\/dashboard/);
  26 | }
  27 | 
  28 | test.describe("§41 Test 1 & 2 — ticket creation and assignment propagate live", () => {
  29 |   test("a ticket created by one user appears for another without a reload", async ({
  30 |     browser,
  31 |   }) => {
  32 |     const contextA = await browser.newContext();
  33 |     const contextB = await browser.newContext();
  34 |     const pageA = await contextA.newPage();
  35 |     const pageB = await contextB.newPage();
  36 | 
  37 |     await loginAs(pageA, USER_A.email);
  38 |     await loginAs(pageB, USER_B.email);
  39 | 
  40 |     await pageA.goto("/tickets");
  41 |     await pageB.goto("/tickets");
  42 | 
  43 |     const title = `Realtime test ticket ${Date.now()}`;
  44 | 
  45 |     // Test 1 (§41): create in Browser A.
  46 |     await pageA.getByRole("button", { name: "New ticket" }).click();
  47 |     await pageA.getByLabel("Title").fill(title);
  48 |     await pageA.getByRole("button", { name: "Create ticket" }).click();
  49 | 
  50 |     // Check Browser A first — this does NOT depend on realtime at all
  51 |     // (its own mutation invalidates its own query on success), so a
  52 |     // failure here means ticket creation itself is broken, not
  53 |     // propagation. Splitting this out turns "Browser B never sees it"
  54 |     // from one failure into two, so a red run actually points at which
  55 |     // half is broken instead of leaving both as suspects.
  56 |     await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });
  57 | 
  58 |     // The real assertion: Browser B never reloads or navigates. If this
  59 |     // only passes after a manual pageB.reload(), the realtime wiring
  60 |     // (broadcast → RLS-authorized subscription → invalidateQueries)
  61 |     // isn't actually working — a passing test with a reload added would
  62 |     // be testing the wrong thing.
  63 |     await expect(pageB.getByText(title)).toBeVisible({ timeout: 10_000 });
  64 | 
  65 |     // Test 2 (§41): assign it to Browser B's user, from Browser A.
  66 |     await pageA.getByText(title).click();
  67 |     await pageA.getByLabel("Assignee").selectOption({ label: USER_B.name });
  68 |     await pageA.getByRole("button", { name: "Save changes" }).click();
  69 | 
  70 |     // Browser B should see itself assigned without any reload either —
  71 |     // the avatar/assignment indicator replacing "Assign to me" on that
  72 |     // row is the visible signal.
  73 |     const rowB = pageB.locator("li", { hasText: title });
> 74 |     await expect(rowB.getByTitle(USER_B.name)).toBeVisible({
     |                                                ^ Error: expect(locator).toBeVisible() failed
  75 |       timeout: 10_000,
  76 |     });
  77 | 
  78 |     await contextA.close();
  79 |     await contextB.close();
  80 |   });
  81 | });
```