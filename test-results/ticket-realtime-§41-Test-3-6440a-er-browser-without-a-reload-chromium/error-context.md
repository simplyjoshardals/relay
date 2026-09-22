# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ticket-realtime.spec.ts >> §41 Test 3, 4 & 5 — incident creation, ticket-linked impact, and response propagate live >> an incident, its linked tickets, and its responder all appear for another browser without a reload
- Location: e2e\ticket-realtime.spec.ts:118:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Realtime test incident 1790110427773')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Realtime test incident 1790110427773') with timeout 10000ms
  - waiting for getByText('Realtime test incident 1790110427773')

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
    - link "Team":
      - /url: /team
  - status: Live
  - text: MR
  - button "Sign out":
    - img
- main:
  - heading "Incidents" [level=1]
  - paragraph: 1 active · 1 total
  - button "New incident":
    - img
    - text: New incident
  - button "All 1"
  - button "Investigating 1"
  - button "Identified 0"
  - button "Monitoring 0"
  - button "Resolved 0"
  - img
  - textbox "Search incidents"
  - list:
    - button "Critical Testing Investigating · Opened 19m ago · open 19m · Movies Api MR"
  - dialog "New incident":
    - heading "New incident" [level=2]
    - button "Close":
      - img
    - text: Title
    - textbox "Title":
      - /placeholder: Short, specific summary
      - text: Realtime test incident 1790110427773
    - text: Description
    - textbox "Description":
      - /placeholder: Optional detail
    - text: Status
    - combobox "Status":
      - option "Investigating" [selected]
      - option "Identified"
      - option "Monitoring"
      - option "Resolved"
    - text: Severity
    - combobox "Severity":
      - option "Low"
      - option "Medium" [selected]
      - option "High"
      - option "Critical"
    - text: Responder
    - combobox "Responder":
      - option "Unassigned" [selected]
      - option "Josh Dietrich"
      - option "Leo Fontaine"
      - option "Maya Reyes"
      - option "Priya Nair"
      - option "Sana Kapoor"
    - text: Affected services
    - checkbox "Auth"
    - text: Auth
    - checkbox "Checkout"
    - text: Checkout
    - checkbox "Movies Api"
    - text: Movies Api
    - checkbox "Payments API" [checked]
    - text: Payments API Linked tickets
    - checkbox "Impact test ticket B 1790110427773" [checked]
    - text: Impact test ticket B 1790110427773
    - checkbox "Impact test ticket A 1790110427773" [checked]
    - text: Impact test ticket A 1790110427773
    - checkbox "Realtime test ticket 1790110420702"
    - text: Realtime test ticket 1790110420702
    - checkbox "Reconnect test ticket 1790109384587"
    - text: Reconnect test ticket 1790109384587
    - checkbox "Impact test ticket B 1790109333396"
    - text: Impact test ticket B 1790109333396
    - checkbox "Impact test ticket A 1790109333396"
    - text: Impact test ticket A 1790109333396
    - checkbox "Realtime test ticket 1790109325842"
    - text: Realtime test ticket 1790109325842
    - checkbox "Reconnect test ticket 1790108560244"
    - text: Reconnect test ticket 1790108560244
    - checkbox "Impact test ticket B 1790108505518"
    - text: Impact test ticket B 1790108505518
    - checkbox "Impact test ticket A 1790108505518"
    - text: Impact test ticket A 1790108505518
    - checkbox "Realtime test ticket 1790108496700"
    - text: Realtime test ticket 1790108496700
    - checkbox "Reconnect test ticket 1790108087412"
    - text: Reconnect test ticket 1790108087412
    - checkbox "Impact test ticket B 1790108032088"
    - text: Impact test ticket B 1790108032088
    - checkbox "Impact test ticket A 1790108032088"
    - text: Impact test ticket A 1790108032088
    - checkbox "Realtime test ticket 1790108024503"
    - text: Realtime test ticket 1790108024503
    - checkbox "Reconnect test ticket 1790043880797"
    - text: Reconnect test ticket 1790043880797
    - checkbox "Realtime test ticket 1790043862395"
    - text: Realtime test ticket 1790043862395
    - checkbox "Reconnect test ticket 1790043607201"
    - text: Reconnect test ticket 1790043607201
    - checkbox "Realtime test ticket 1790043590611"
    - text: Realtime test ticket 1790043590611
    - checkbox "Reconnect test ticket 1790043322374"
    - text: Reconnect test ticket 1790043322374
    - checkbox "Realtime test ticket 1790043306133"
    - text: Realtime test ticket 1790043306133
    - checkbox "Resolve intermittent 502 Bad Gateway errors on the user checkout API"
    - text: Resolve intermittent 502 Bad Gateway errors on the user checkout API
    - checkbox "Login button unresponsive on mobile"
    - text: Login button unresponsive on mobile
    - checkbox "401 error"
    - text: 401 error
    - paragraph: Invalid UUID
    - button "Cancel"
    - button "Create incident"
- button "Open Tanstack query devtools":
  - img
- alert
```

# Test source

```ts
  62  |     await pageA.getByRole("button", { name: "New ticket" }).click();
  63  |     await pageA.getByLabel("Title").fill(title);
  64  |     await pageA.getByRole("button", { name: "Create ticket" }).click();
  65  | 
  66  |     // Check Browser A first — this does NOT depend on realtime at all
  67  |     // (its own mutation invalidates its own query on success), so a
  68  |     // failure here means ticket creation itself is broken, not
  69  |     // propagation. Splitting this out turns "Browser B never sees it"
  70  |     // from one failure into two, so a red run actually points at which
  71  |     // half is broken instead of leaving both as suspects.
  72  |     await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });
  73  | 
  74  |     // The real assertion: Browser B never reloads or navigates. If this
  75  |     // only passes after a manual pageB.reload(), the realtime wiring
  76  |     // (broadcast → RLS-authorized subscription → invalidateQueries)
  77  |     // isn't actually working — a passing test with a reload added would
  78  |     // be testing the wrong thing.
  79  |     await expect(pageB.getByText(title)).toBeVisible({ timeout: 10_000 });
  80  | 
  81  |     // Test 2 (§41): assign it to Browser B's user, from Browser A.
  82  |     await pageA.getByText(title).click();
  83  |     await pageA.getByLabel("Assignee").selectOption({ label: USER_B.name });
  84  |     await pageA.getByRole("button", { name: "Save changes" }).click();
  85  | 
  86  |     // Same split as Test 1: confirm the update itself succeeded on
  87  |     // Browser A before blaming propagation. TicketsView's
  88  |     // updateMutation.onSuccess only shows this toast (and closes the
  89  |     // modal) on the ok:true branch — a ConflictError/ValidationError/
  90  |     // NotFoundError from updateTicket() surfaces as an error toast
  91  |     // instead and never reaches broadcastToOrg(), which would make
  92  |     // Browser B's failure below a red herring pointing at realtime when
  93  |     // the actual bug is in the mutation itself.
  94  |     await expect(pageA.getByText("Ticket updated")).toBeVisible({
  95  |       timeout: 10_000,
  96  |     });
  97  | 
  98  |     // The modal closing is the same signal from a different angle —
  99  |     // onSuccess's ok:true branch is also what calls setModalState(null).
  100 |     await expect(
  101 |       pageA.getByRole("heading", { name: "Edit ticket" }),
  102 |     ).toBeHidden({ timeout: 5_000 });
  103 | 
  104 |     // Browser B should see itself assigned without any reload either —
  105 |     // the avatar/assignment indicator replacing "Assign to me" on that
  106 |     // row is the visible signal.
  107 |     const rowB = pageB.locator("li", { hasText: title });
  108 |     await expect(rowB.getByTitle(USER_B.name)).toBeVisible({
  109 |       timeout: 10_000,
  110 |     });
  111 | 
  112 |     await contextA.close();
  113 |     await contextB.close();
  114 |   });
  115 | });
  116 | 
  117 | test.describe("§41 Test 3, 4 & 5 — incident creation, ticket-linked impact, and response propagate live", () => {
  118 |   test("an incident, its linked tickets, and its responder all appear for another browser without a reload", async ({
  119 |     browser,
  120 |   }) => {
  121 |     const contextA = await browser.newContext();
  122 |     const contextB = await browser.newContext();
  123 |     const pageA = await contextA.newPage();
  124 |     const pageB = await contextB.newPage();
  125 | 
  126 |     await loginAs(pageA, USER_A.email);
  127 |     await loginAs(pageB, USER_B.email);
  128 | 
  129 |     // Test 4 ("associate multiple tickets with the incident") needs
  130 |     // real tickets to link against — IncidentModal's checklist lists
  131 |     // actual org tickets (Milestone 5), not placeholder rows, so two
  132 |     // get created here first.
  133 |     const ts = Date.now();
  134 |     const ticketATitle = `Impact test ticket A ${ts}`;
  135 |     const ticketBTitle = `Impact test ticket B ${ts}`;
  136 | 
  137 |     await pageA.goto("/tickets");
  138 |     for (const title of [ticketATitle, ticketBTitle]) {
  139 |       await pageA.getByRole("button", { name: "New ticket" }).click();
  140 |       await pageA.getByLabel("Title").fill(title);
  141 |       await pageA.getByRole("button", { name: "Create ticket" }).click();
  142 |       await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });
  143 |     }
  144 | 
  145 |     await pageA.goto("/incidents");
  146 |     await pageB.goto("/incidents");
  147 | 
  148 |     // Test 3 (§41): create an incident affecting a service, from
  149 |     // Browser A.
  150 |     const incidentTitle = `Realtime test incident ${ts}`;
  151 | 
  152 |     await pageA.getByRole("button", { name: "New incident" }).click();
  153 |     await pageA.getByLabel("Title").fill(incidentTitle);
  154 |     // Seeded by prisma/seed.ts — same service Test 6 below exercises.
  155 |     await pageA.getByRole("checkbox", { name: "Payments API" }).check();
  156 |     await pageA.getByRole("checkbox", { name: ticketATitle }).check();
  157 |     await pageA.getByRole("checkbox", { name: ticketBTitle }).check();
  158 |     await pageA.getByRole("button", { name: "Create incident" }).click();
  159 | 
  160 |     // Same split as Test 1: confirm the create itself succeeded on
  161 |     // Browser A before blaming propagation.
> 162 |     await expect(pageA.getByText(incidentTitle)).toBeVisible({
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  163 |       timeout: 10_000,
  164 |     });
  165 | 
  166 |     // The real assertion for Test 3: Browser B never reloads or
  167 |     // navigates.
  168 |     await expect(pageB.getByText(incidentTitle)).toBeVisible({
  169 |       timeout: 10_000,
  170 |     });
  171 | 
  172 |     // Test 4 (§41): "the incident displays its operational impact" —
  173 |     // both linked tickets showing up as a count on the row, on both
  174 |     // browsers.
  175 |     const rowA = pageA.locator("li", { hasText: incidentTitle });
  176 |     const rowB = pageB.locator("li", { hasText: incidentTitle });
  177 |     await expect(rowA.getByText("2 tickets")).toBeVisible({
  178 |       timeout: 10_000,
  179 |     });
  180 |     await expect(rowB.getByText("2 tickets")).toBeVisible({
  181 |       timeout: 10_000,
  182 |     });
  183 | 
  184 |     // Test 5 (§41): assign the incident to Browser B's user, from
  185 |     // Browser A.
  186 |     await pageA.getByText(incidentTitle).click();
  187 |     await pageA.getByLabel("Responder").selectOption({ label: USER_B.name });
  188 |     await pageA.getByRole("button", { name: "Save changes" }).click();
  189 | 
  190 |     // Confirm the update itself succeeded on Browser A first, same
  191 |     // reasoning as Test 2 above — a rejected update never reaches
  192 |     // broadcastToOrg(), which would make Browser B's check below a
  193 |     // red herring pointing at realtime when the actual bug is in the
  194 |     // mutation itself.
  195 |     await expect(pageA.getByText("Incident updated")).toBeVisible({
  196 |       timeout: 10_000,
  197 |     });
  198 |     await expect(
  199 |       pageA.getByRole("heading", { name: "Edit incident" }),
  200 |     ).toBeHidden({ timeout: 5_000 });
  201 | 
  202 |     // "A sees B as the responder immediately" (§41 Test 5) is the
  203 |     // named assertion, but B seeing itself reflected back without a
  204 |     // reload is the same realtime path and worth checking too.
  205 |     await expect(rowA.getByTitle(`${USER_B.name} responding`)).toBeVisible({
  206 |       timeout: 10_000,
  207 |     });
  208 |     await expect(rowB.getByTitle(`${USER_B.name} responding`)).toBeVisible({
  209 |       timeout: 10_000,
  210 |     });
  211 | 
  212 |     await contextA.close();
  213 |     await contextB.close();
  214 |   });
  215 | });
  216 | 
  217 | test.describe("§41 Test 6 — service degradation propagates live", () => {
  218 |   test("a degraded reading is visible on both dashboards without a reload", async ({
  219 |     browser,
  220 |   }) => {
  221 |     const contextA = await browser.newContext();
  222 |     const contextB = await browser.newContext();
  223 |     const pageA = await contextA.newPage();
  224 |     const pageB = await contextB.newPage();
  225 | 
  226 |     await loginAs(pageA, USER_A.email);
  227 |     await loginAs(pageB, USER_B.email);
  228 | 
  229 |     await pageA.goto("/services");
  230 |     await pageB.goto("/services");
  231 | 
  232 |     const cardA = pageA.getByTestId("service-card-Payments API");
  233 |     const cardB = pageB.getByTestId("service-card-Payments API");
  234 | 
  235 |     // Both start OPERATIONAL — prisma/seed.ts's create default, assuming
  236 |     // nothing else in this run already degraded it. Asserted first so a
  237 |     // failure below can't be misread as "was already degraded."
  238 |     await expect(cardA.getByText("Operational")).toBeVisible({
  239 |       timeout: 10_000,
  240 |     });
  241 |     await expect(cardB.getByText("Operational")).toBeVisible({
  242 |       timeout: 10_000,
  243 |     });
  244 | 
  245 |     // The simulation itself. There's no UI affordance for this —
  246 |     // status/latency/errorRate are deliberately telemetry-only (README
  247 |     // §13, ServiceModal.tsx's doc comment), never a field a human
  248 |     // submits through a form. The real telemetry worker
  249 |     // (workers/telemetry.ts) would eventually produce a DEGRADED
  250 |     // reading through its own random walk, but "eventually, randomly,
  251 |     // on a ~4s tick with a 6% spike chance" isn't reliable to await in
  252 |     // a test — so this calls the exact same application-layer function
  253 |     // the worker calls on the tick where it decides a reading is
  254 |     // degraded (same version-checked write, same Activity row, same
  255 |     // broadcastToOrg() call), just invoked directly and deterministically
  256 |     // rather than waiting on the worker's own timer. This is standing in
  257 |     // for one worker tick, not bypassing the architecture Test 6 is
  258 |     // meant to exercise.
  259 |     const PAYMENTS_SERVICE_ID = "00000000-0000-0000-0000-000000000101";
  260 |     const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";
  261 | 
  262 |     await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
```