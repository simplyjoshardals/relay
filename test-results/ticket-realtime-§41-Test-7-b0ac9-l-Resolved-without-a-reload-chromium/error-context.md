# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ticket-realtime.spec.ts >> §41 Test 7 — recovery: service restore and incident resolution converge >> both browsers converge on Operational/Resolved without a reload
- Location: e2e\ticket-realtime.spec.ts:293:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Recovery test incident 1790110458884')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Recovery test incident 1790110458884') with timeout 10000ms
  - waiting for getByText('Recovery test incident 1790110458884')

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
      - text: Recovery test incident 1790110458884
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
    - checkbox "Impact test ticket B 1790110427773"
    - text: Impact test ticket B 1790110427773
    - checkbox "Impact test ticket A 1790110427773"
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
  263 |       latencyMs: 420,
  264 |       errorRate: 3.8,
  265 |       status: "DEGRADED",
  266 |     });
  267 | 
  268 |     // Neither browser reloads or navigates from here. §7's debounce
  269 |     // (RealtimeProvider.tsx) allows up to ~1.5s before the invalidation
  270 |     // fires, on top of ordinary network/render time.
  271 |     await expect(cardA.getByText("Degraded")).toBeVisible({
  272 |       timeout: 10_000,
  273 |     });
  274 |     await expect(cardB.getByText("Degraded")).toBeVisible({
  275 |       timeout: 10_000,
  276 |     });
  277 | 
  278 |     // Restore the seed row to OPERATIONAL so a re-run of this test (or
  279 |     // the real telemetry worker's next tick, if it's running) doesn't
  280 |     // inherit a DEGRADED starting point.
  281 |     await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
  282 |       latencyMs: 110,
  283 |       errorRate: 0.3,
  284 |       status: "OPERATIONAL",
  285 |     });
  286 | 
  287 |     await contextA.close();
  288 |     await contextB.close();
  289 |   });
  290 | });
  291 | 
  292 | test.describe("§41 Test 7 — recovery: service restore and incident resolution converge", () => {
  293 |   test("both browsers converge on Operational/Resolved without a reload", async ({
  294 |     browser,
  295 |   }) => {
  296 |     const contextA = await browser.newContext();
  297 |     const contextB = await browser.newContext();
  298 |     const pageA = await contextA.newPage();
  299 |     const pageB = await contextB.newPage();
  300 | 
  301 |     await loginAs(pageA, USER_A.email);
  302 |     await loginAs(pageB, USER_B.email);
  303 |     await pageA.goto("/incidents");
  304 |     await pageB.goto("/incidents");
  305 | 
  306 |     // A fresh incident for this test rather than reusing Test 3/4/5's
  307 |     // (a separate Playwright test file/run has no ordering guarantee
  308 |     // against it) — affecting the same seeded service Test 6 degrades,
  309 |     // so restoring that service below is the same "the affected
  310 |     // service" §41 Test 7 describes, not an unrelated one.
  311 |     const PAYMENTS_SERVICE_ID = "00000000-0000-0000-0000-000000000101";
  312 |     const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";
  313 |     const incidentTitle = `Recovery test incident ${Date.now()}`;
  314 | 
  315 |     await pageA.getByRole("button", { name: "New incident" }).click();
  316 |     await pageA.getByLabel("Title").fill(incidentTitle);
  317 |     await pageA.getByRole("checkbox", { name: "Payments API" }).check();
  318 |     await pageA.getByRole("button", { name: "Create incident" }).click();
> 319 |     await expect(pageA.getByText(incidentTitle)).toBeVisible({
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  320 |       timeout: 10_000,
  321 |     });
  322 |     await expect(pageB.getByText(incidentTitle)).toBeVisible({
  323 |       timeout: 10_000,
  324 |     });
  325 | 
  326 |     // The service side of "recovery" — same standing-in-for-a-worker-
  327 |     // tick reasoning Test 6 documents: degrade first (an incident
  328 |     // affecting an already-healthy service wouldn't be much of a
  329 |     // recovery to observe), then restore.
  330 |     await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
  331 |       latencyMs: 420,
  332 |       errorRate: 3.8,
  333 |       status: "DEGRADED",
  334 |     });
  335 |     await updateServiceTelemetry(SEED_ORG_ID, PAYMENTS_SERVICE_ID, {
  336 |       latencyMs: 110,
  337 |       errorRate: 0.3,
  338 |       status: "OPERATIONAL",
  339 |     });
  340 | 
  341 |     // The incident side: resolve it from Browser A.
  342 |     await pageA.getByText(incidentTitle).click();
  343 |     await pageA.getByLabel("Status").selectOption({ label: "Resolved" });
  344 |     await pageA.getByRole("button", { name: "Save changes" }).click();
  345 |     await expect(pageA.getByText("Incident updated")).toBeVisible({
  346 |       timeout: 10_000,
  347 |     });
  348 | 
  349 |     // "Both clients converge on the same final state" (§41 Test 7):
  350 |     // neither browser reloads, and both end up showing the incident
  351 |     // as Resolved.
  352 |     // Exact match: the row also shows "Resolved 5s ago" as a separate
  353 |     // element (incident.resolvedAt's relative time), which also
  354 |     // contains the substring "Resolved" and would otherwise make this
  355 |     // locator resolve to two elements.
  356 |     const rowA = pageA.locator("li", { hasText: incidentTitle });
  357 |     const rowB = pageB.locator("li", { hasText: incidentTitle });
  358 |     await expect(rowA.getByText("Resolved", { exact: true })).toBeVisible({
  359 |       timeout: 10_000,
  360 |     });
  361 |     await expect(rowB.getByText("Resolved", { exact: true })).toBeVisible({
  362 |       timeout: 10_000,
  363 |     });
  364 | 
  365 |     await contextA.close();
  366 |     await contextB.close();
  367 |   });
  368 | });
  369 | 
  370 | test.describe("§41 Test 8 — disconnect, then reconnect and reconcile", () => {
  371 |   test("shows a clear connection-lost state, then reconciles on reconnect", async ({
  372 |     browser,
  373 |   }) => {
  374 |     const contextA = await browser.newContext();
  375 |     const contextB = await browser.newContext();
  376 |     const pageA = await contextA.newPage();
  377 |     const pageB = await contextB.newPage();
  378 | 
  379 |     await loginAs(pageA, USER_A.email);
  380 |     await loginAs(pageB, USER_B.email);
  381 |     await pageA.goto("/tickets");
  382 |     await pageB.goto("/tickets");
  383 | 
  384 |     // Browser B starts live.
  385 |     await expect(
  386 |       pageB.getByRole("status").filter({ hasText: "Live" }),
  387 |     ).toBeVisible({ timeout: 15_000 });
  388 | 
  389 |     // "Kill the network connection" (§41 Test 8) on Browser B only.
  390 |     await contextB.setOffline(true);
  391 | 
  392 |     // A clear connection-lost state: the indicator flips and the page
  393 |     // says its data may be stale. This is driven by the browser's
  394 |     // 'offline' event, so it holds even though Playwright's offline
  395 |     // emulation doesn't reliably sever an already-open WebSocket.
  396 |     await expect(
  397 |       pageB.getByRole("status").filter({ hasText: "Offline" }),
  398 |     ).toBeVisible({ timeout: 5_000 });
  399 |     // Filtered by text: Next.js's own route announcer is also
  400 |     // role="alert" on every page, so a bare getByRole("alert") matches
  401 |     // two elements and trips Playwright's strict mode.
  402 |     const staleBanner = pageB
  403 |       .getByRole("alert")
  404 |       .filter({ hasText: "out of date" });
  405 |     await expect(staleBanner).toBeVisible();
  406 | 
  407 |     // Meanwhile Browser A (still online) makes a change B can't have
  408 |     // received through a healthy connection.
  409 |     const title = `Reconnect test ticket ${Date.now()}`;
  410 |     await pageA.getByRole("button", { name: "New ticket" }).click();
  411 |     await pageA.getByLabel("Title").fill(title);
  412 |     await pageA.getByRole("button", { name: "Create ticket" }).click();
  413 |     await expect(pageA.getByText(title)).toBeVisible({ timeout: 10_000 });
  414 | 
  415 |     // Restore the connection. B must reconnect on its own — no reload —
  416 |     // return to Live, drop the warning, and reconcile with server state
  417 |     // (§35: invalidate everything on SUBSCRIBED), which is where the
  418 |     // ticket created during the outage shows up.
  419 |     await contextB.setOffline(false);
```