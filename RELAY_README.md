# Relay

## Product Definition, Requirements & System Architecture

**Version:** 0.2  
**Status:** MVP planning + implementation architecture resolved  
**Product:** Relay  
**Authentication:** JWT-based authentication (NOT Supabase Auth)
**Stack:** Next.js (App Router) · Prisma ORM over a direct Postgres connection · Supabase for Postgres hosting + Realtime only

---

# 1. Product Definition

## 1.1 What is Relay?

Relay is a real-time operations platform for small and medium-sized SaaS and digital businesses whose customer-facing operations depend on multiple internal services.

These teams need a shared, live view of their **work, people, and system health**, because operational activity and technical incidents are often scattered across different tools.

Relay connects those things into one operational picture, allowing teams to see what is happening, understand what is affected, know who is responding, and track the situation as it changes in real time.

## 1.2 The Core Problem

When something happens, the team should not have to piece together:

- What happened?
- What is affected?
- Who is dealing with it?
- How bad is it?
- Is it getting better?

from five different places.

Relay provides that context in one place.

## 1.3 The Four Things Relay Connects

### Work

- Tickets
- Operational tasks

### Systems

- Services
- Health
- Latency
- Errors

### People

- Who is online
- Who owns something
- Who is responding

### Events

- What just happened
- What changed
- What is happening now

The defining characteristic is:

> **The state is live.**

This is not a dashboard that requires manual refreshes to understand what is happening.

---

# 2. Requirements Specification

## 2.1 Scope

### In Scope

Relay MVP must provide:

1. Team/work management
2. System/service monitoring
3. Incident management
4. Real-time synchronization
5. Team presence
6. Real-time activity history
7. A unified operational dashboard
8. JWT authentication and role-based access
9. Reliable handling of connection failures and synchronization

### Out of Scope

The MVP will NOT include:

- Chat/messaging
- Email/SMS notifications
- AI features
- Billing/subscriptions
- Mobile applications
- Third-party integrations
- Advanced analytics
- Custom dashboards
- Automation/workflows
- Customer-facing portals
- Complex enterprise RBAC
- Real production infrastructure monitoring

For system health, the MVP will use simulated/internal service telemetry rather than attempting to become a full monitoring platform such as Datadog.

---

# 3. Users

Relay has two initial user types.

## 3.1 Operations Member

Can:

- View operational work
- Update work
- Assign work
- View system health
- Create/manage incidents
- Participate in incident response
- View activity
- See active team members

## 3.2 Operations Manager

Everything an Operations Member can do, plus:

- Manage team members
- Manage monitored services
- View the complete operational picture
- Manage incidents
- Review historical activity

Permissions should remain intentionally simple for the MVP.

---

# 4. Operational Work Requirements

For MVP, operational work is represented by a single entity: **Ticket**.

A Ticket represents a piece of operational work that someone on the team needs to handle.

A Ticket contains at minimum:

- Title
- Description
- Status
- Priority
- Assignee
- Creator
- Creation timestamp
- Last updated timestamp

## 4.1 Ticket Status

Initial lifecycle:

```text
OPEN
  ↓
IN_PROGRESS
  ↓
RESOLVED
```

The MVP may also support:

```text
BLOCKED
```

where appropriate.

## 4.2 Requirements

- **WR-01** — Users must be able to create a ticket.
- **WR-02** — Users must be able to assign a ticket to a team member.
- **WR-03** — Users must be able to change ticket status.
- **WR-04** — Users must be able to change ticket priority.
- **WR-05** — Users must be able to view the current state of a ticket.
- **WR-06** — Ticket changes must be reflected to other authorized connected users in real time.
- **WR-07** — Significant ticket changes must be recorded in activity history.

---

# 5. Service Monitoring Requirements

Relay represents the systems/services that the business depends on.

A Service contains:

- Name
- Description
- Current status
- Current latency
- Error rate
- Last updated timestamp

## 5.1 Service States

```text
OPERATIONAL
DEGRADED
OUTAGE
```

## 5.2 Requirements

- **SM-01** — Users must be able to view all monitored services.
- **SM-02** — Users must be able to view the current health of each service.
- **SM-03** — Service telemetry must update in real time.
- **SM-04** — The dashboard must clearly communicate degraded or unavailable services.
- **SM-05** — Changes in service health must generate system events.
- **SM-06** — Service telemetry must be distinguishable from manually created operational activity.

---

# 6. Incident Requirements

An Incident represents a significant system or operational problem.

An Incident contains:

- Title
- Description
- Status
- Severity
- Responsible person
- Affected service(s)
- Affected ticket(s)
- Created timestamp
- Resolved timestamp

## 6.1 Incident Status

```text
INVESTIGATING
      ↓
IDENTIFIED
      ↓
MONITORING
      ↓
RESOLVED
```

## 6.2 Severity

```text
LOW
MEDIUM
HIGH
CRITICAL
```

## 6.3 Requirements

- **IN-01** — Authorized users must be able to create an incident.
- **IN-02** — An incident must be associated with one or more services.
- **IN-03** — An incident may be associated with affected tickets.
- **IN-04** — Users must be able to assign an incident to a responder.
- **IN-05** — Users must be able to update incident status.
- **IN-06** — Users must be able to update incident severity.
- **IN-07** — Resolving an incident must record when it was resolved.
- **IN-08** — Incident changes must propagate to authorized connected clients in real time.
- **IN-09** — Creating, updating, assigning, and resolving incidents must generate activity events.

---

# 7. Core Domain Relationship

This is the central relationship in Relay:

```text
SERVICE
   ↓
INCIDENT
   ↓
AFFECTED TICKETS
   ↓
RESPONDERS
```

Example:

```text
Payment Service
      ↓
Incident #17
      ↓
23 affected tickets
      ↓
Michael + Sarah responding
```

When viewing an incident, a user should be able to answer:

- What is broken?
- What does it affect?
- Who is dealing with it?
- What is the current state?

This relationship is the primary reason the product exists.

---

# 8. Relationship Decisions

## 8.1 Ticket ↔ Incident

A ticket can be affected by multiple incidents **over its lifetime**, but only one active incident relationship at a time.

Example:

```text
Ticket #482
  ├── Incident #17 (resolved)
  └── Incident #42 (resolved)
```

Historical relationships remain intact.

## 8.2 Incident ↔ Service

An incident can affect one or many services.

Example:

```text
Incident #17
 ├── Payment API
 ├── Checkout API
 └── Order Processing
```

## 8.3 Service ↔ Incidents

A service can have multiple simultaneous incidents.

Service status represents its current operational state.

Incidents represent individual operational problems.

These concepts must not be conflated.

---

# 9. Incident Creation & Service Recovery

The MVP does **not** automatically create incidents.

Telemetry may cause:

```text
OPERATIONAL → DEGRADED
```

but does not automatically create an Incident.

A human decides when a degradation is significant enough to open an incident.

Similarly, when telemetry recovers:

```text
DEGRADED → OPERATIONAL
```

an existing incident is NOT automatically resolved.

A human must resolve the incident.

Therefore:

> **Telemetry describes system state.**
>
> **Incidents describe human-recognized operational problems.**

---

# 10. Real-Time Requirements

Realtime is a core system requirement, not an optional UI feature.

The following shared domain changes must propagate to authorized connected clients without requiring a page refresh:

### Tickets

- Creation
- Assignment
- Status
- Priority
- Deletion, if deletion is ever introduced

### Services

- Status
- Latency
- Error rate

### Incidents

- Creation
- Assignment
- Status
- Severity
- Affected services
- Affected tickets

### Activity

- New activity events

### Presence

- Online/offline state

Not every piece of UI state needs to be realtime.

Shared domain state does.

---

# 11. Realtime Reliability

- **RT-01** — Connected authorized clients must receive relevant shared state changes without manual refresh.
- **RT-02** — The UI must clearly indicate when realtime connectivity is lost.
- **RT-03** — The client must attempt reconnection after connection loss.
- **RT-04** — After reconnecting, the client must reconcile local state with authoritative server state.
- **RT-05** — The system must tolerate duplicate realtime events without corrupting application state.
- **RT-06** — Realtime delivery must not be treated as the source of truth.

Core principle:

> **Realtime makes things fast. Server synchronization makes things correct.**

---

# 12. Concurrent Updates

Relay is NOT a collaborative text editor and does not require CRDTs or character-level synchronization.

The server is authoritative.

If two clients modify the same resource concurrently, the system should use optimistic concurrency/version checking to detect stale mutations.

Conceptually:

```text
Ticket version: 7

Client A updates version 7
        ↓
Success → version 8

Client B updates version 7
        ↓
Stale mutation → rejected
        ↓
Client B reconciles with server
```

The exact mechanism is an architectural implementation detail and should be determined during implementation planning.

---

# 13. Activity Requirements

The Activity stream records meaningful operational changes.

Examples:

```text
TICKET_CREATED
TICKET_ASSIGNED
TICKET_STATUS_CHANGED
TICKET_PRIORITY_CHANGED

SERVICE_STATUS_CHANGED

INCIDENT_CREATED
INCIDENT_ASSIGNED
INCIDENT_STATUS_CHANGED
INCIDENT_RESOLVED

USER_JOINED
USER_LEFT
```

The system should NOT record meaningless UI interactions such as simply opening a dashboard.

## Requirements

- **AC-01** — Significant domain actions must generate activity events.
- **AC-02** — Activity must include actor, action, target, and timestamp.
- **AC-03** — Authorized users must be able to view the activity stream.
- **AC-04** — New activity must appear in real time.
- **AC-05** — Activity history must persist after users disconnect.
- Activity should be paginated rather than loading an unbounded history into the browser.

---

# 14. Presence Requirements

Presence represents currently connected authenticated users.

- **PR-01** — Online users must appear as online without requiring refresh.
- **PR-02** — Disconnecting users should eventually appear offline.
- **PR-03** — Presence should be treated as ephemeral state rather than ordinary persistent database state.

Optional enhancement:

Users may be shown as viewing or working on a specific ticket/incident.

---

# 15. Dashboard Requirements

The dashboard is the operational overview, not another CRUD screen.

A user should immediately understand:

### What's happening?

Current operational workload.

### What's broken?

Current system/service health.

### What's urgent?

Active incidents and high-priority work.

### Who's handling it?

Assignments and responders.

### What just happened?

Live activity.

The dashboard must expose:

- Active work summary
- Service health summary
- Active incident summary
- Team presence
- Live activity
- Relationship between incidents and affected tickets

---

# 16. Authentication & Authorization

Relay uses **JWT-based authentication**.

**Supabase Auth is NOT used.**

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to do?

Requirements:

- **AUTH-01** — Users must authenticate before accessing Relay.
- **AUTH-02** — Unauthenticated users must not access protected application data.
- **AUTH-03** — Users must only access data belonging to their organization/workspace.
- **AUTH-04** — Manager-only operations must be protected from regular members.
- **AUTH-05** — Authorization must be enforced server-side.
- **AUTH-06** — JWT validation must occur on trusted server-side boundaries.
- **AUTH-07** — The frontend must never be treated as a security boundary.

The exact JWT implementation, token storage, refresh strategy, and middleware/API enforcement are architecture/implementation decisions to be finalized by the implementation team.

---

# 17. Multi-Tenancy

Relay should conceptually support multiple organizations:

```text
Organization A
 ├── Users
 ├── Tickets
 ├── Services
 └── Incidents

Organization B
 ├── Users
 ├── Tickets
 ├── Services
 └── Incidents
```

Users from Organization A must never access Organization B's data.

Every organization-owned resource must have an organization boundary.

Database-level security should enforce tenant isolation.

---

# 18. Error & Failure Handling

The application must behave predictably when:

- Network connectivity disappears
- Realtime connection drops
- A mutation fails
- Server returns an error
- User submits invalid data
- Multiple users modify the same resource

The application must:

- Show meaningful errors
- Avoid silently losing changes
- Avoid presenting obviously stale state as current
- Recover from reconnects
- Reconcile with server authority

Optimistic UI is permitted, but optimistic state is never authoritative.

---

# 19. Deletion & Historical Data

Hard deletion should be extremely limited in the MVP.

For MVP:

- Tickets: no deletion
- Incidents: no deletion
- Services: no deletion

Use lifecycle state or archival concepts later if required.

Historical incident relationships and activity records must remain intact.

Relay is an operational record system, so destroying historical context undermines its purpose.

---

# 20. Domain Model

The initial domain consists of:

```text
Organization
User
Ticket
Service
Incident
Activity
```

Conceptual relationship:

```text
                 ORGANIZATION
                      │
          ┌───────────┼───────────┐
          │           │           │
        USERS       TICKETS     SERVICES
          │           │           │
          │           │           │
          │           └────┬──────┘
          │                │
          │             INCIDENTS
          │                │
          └────────────────┘
                   │
                ACTIVITY
```

Realtime is not a business entity. It is the synchronization mechanism operating across shared domain state.

---

# 21. Non-Functional Requirements

## Performance

The application should remain responsive while receiving frequent realtime events.

## Security

- JWT authentication
- Server-side authorization
- Organization isolation
- Validated input
- No unauthorized data exposure

## Maintainability

Clear separation between:

- UI
- Domain logic
- Application/use-case logic
- Data access
- Realtime synchronization
- Validation

## Observability

The application should provide sufficient logging and error information to diagnose failures during development.

---

# 22. System Architecture

## 22.1 Architectural Style

Relay MVP uses a **modular monolith**.

We are NOT using:

- Microservices
- Separate realtime infrastructure
- Kafka
- Redis
- Kubernetes
- Event sourcing
- CQRS everywhere
- A custom WebSocket server

The system should remain simple enough to develop and reason about while maintaining clear internal boundaries.

---

# 23. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │       Browser        │
                    │                      │
                    │    Relay Web App     │
                    └──────────┬───────────┘
                               │
                    HTTPS / Realtime
                               │
                    ┌──────────▼───────────┐
                    │      Next.js         │
                    │     Application      │
                    └──────────┬───────────┘
                               │
                  ┌────────────┼────────────┐
                  │            │            │
                  ▼            ▼            ▼
              Auth/API     Domain Logic   Realtime
                  │            │            │
                  └────────────┼────────────┘
                               │
                    ┌──────────▼───────────┐
                    │       Supabase       │
                    │                      │
                    │ PostgreSQL + Realtime│
                    │                      │
                    └──────────────────────┘
```

JWT authentication is handled by the application's authentication system, NOT Supabase Auth.

Supabase is used for PostgreSQL and Realtime.

---

# 24. Architectural Layers

Relay should be organized conceptually into five layers.

```text
┌───────────────────────────────────────────┐
│                 PRESENTATION               │
│        Next.js UI / React components       │
├───────────────────────────────────────────┤
│               CLIENT STATE                 │
│        Server cache / local UI state       │
├───────────────────────────────────────────┤
│              APPLICATION                  │
│       Commands / Queries / Validation      │
├───────────────────────────────────────────┤
│                DOMAIN                     │
│    Tickets / Incidents / Services / etc.  │
├───────────────────────────────────────────┤
│               PERSISTENCE                 │
│          PostgreSQL / Supabase             │
└───────────────────────────────────────────┘
```

The implementation must preserve clear responsibility boundaries between these layers.

---

# 25. Presentation Layer

Responsibilities:

- Render UI
- Collect user input
- Display loading/error states
- Trigger application operations
- Subscribe to realtime changes
- Reflect current application state

The UI should not contain core business rules.

For example, the UI should not be responsible for determining whether an incident transition is valid.

---

# 26. Client State

Recommended initial approach:

### TanStack Query

Use for:

- Tickets
- Incidents
- Services
- Activity
- Users
- Server data
- Caching
- Refetching
- Synchronization

### React state

Use for:

- Modal state
- Form state
- Temporary UI state
- Selected filters

### Zustand

Do NOT introduce Zustand by default.

If a genuine cross-cutting client-state requirement appears, it can be evaluated later.

Avoid creating multiple sources of truth for server state.

---

# 27. Application Layer

The application layer exposes explicit use cases rather than allowing UI code to directly manipulate persistence.

Examples:

```text
createTicket()
assignTicket()
updateTicketStatus()

createIncident()
assignIncident()
updateIncidentStatus()
resolveIncident()

updateServiceTelemetry()
```

Conceptually:

```text
UI
 │
 ▼
Application Use Case
 │
 ├── Validate input
 ├── Check authorization
 ├── Execute domain operation
 ├── Persist changes
 └── Produce activity
```

---

# 28. Domain Layer

The domain layer owns:

- Valid statuses
- Valid transitions
- Business invariants
- Entity relationships
- Incident lifecycle
- Ticket lifecycle
- Rules that should remain true regardless of UI

Example:

```text
Ticket:

OPEN
  ↓
IN_PROGRESS
  ↓
RESOLVED
```

The frontend must not be the only place where these rules are enforced.

---

# 29. Persistence Layer

PostgreSQL is the authoritative source of persistent domain state.

It should handle:

- Storage
- Queries
- Transactions
- Foreign keys
- Constraints
- Indexes
- Tenant isolation/security

The database should enforce data integrity where appropriate rather than relying exclusively on application code.

---

# 30. Source of Truth

The central architectural principle is:

> **PostgreSQL is the source of truth.**

Realtime is a distribution mechanism.

The architecture is:

```text
                    PostgreSQL
                   SOURCE OF TRUTH
                         │
             ┌───────────┴───────────┐
             │                       │
        Application              Realtime
        operations                events
             │                       │
             ▼                       ▼
        Authoritative             Connected
           state                   clients
```

Do not build application correctness around the assumption that every realtime event will always arrive exactly once.

---

# 31. Realtime Architecture

Supabase Realtime is used for live synchronization.

A typical mutation flow:

```text
Client A
   │
   │ mutation
   ▼
Application
   │
   ▼
PostgreSQL
   │
   │ committed change
   ▼
Supabase Realtime
   │
   ├───────────────┐
   ▼               ▼
Client A         Client B
update cache     update cache
```

The database mutation occurs before the realtime distribution.

---

# 32. Realtime Event Categories

## Domain Changes

```text
ticket.updated
incident.created
incident.updated
service.updated
```

These represent persistent domain state changes.

## Activity

```text
activity.created
```

These represent meaningful historical events.

## Presence

```text
user.online
user.offline
```

Presence is ephemeral state.

These categories should remain conceptually distinct.

---

# 33. Mutation & Activity Transaction

When an operation changes domain state and creates an activity record, the changes should be committed atomically.

Example:

```text
assignTicket()
      │
      ▼
Database Transaction
      │
      ├── Update Ticket
      │
      └── Create Activity
      │
      ▼
    COMMIT
      │
      ▼
Realtime distribution
```

We must avoid situations where the ticket changes successfully but its corresponding activity record does not.

---

# 34. Optimistic Updates

Optimistic UI is encouraged for appropriate interactions.

Example:

```text
User clicks "Resolve"
       │
       ├──────────────► UI immediately shows RESOLVED
       │
       ▼
    Server
       │
    succeeds
       │
       ▼
Realtime confirms
```

If the mutation fails:

```text
Optimistic state
       ↓
Mutation fails
       ↓
Rollback / reconcile
       ↓
Authoritative server state
```

Optimistic UI is a UX mechanism, not a source of truth.

---

# 35. Reconnection

The application should follow:

```text
CONNECTED
    │
    ▼
Realtime subscription
    │
    │ connection lost
    ▼
DISCONNECTED
    │
    ▼
Reconnect
    │
    ▼
Synchronize server state
    │
    ▼
CONNECTED
```

The system should not attempt to build a complex custom event-replay system for the MVP.

After reconnecting, relevant server queries can be invalidated/refetched so the client converges on authoritative state.

---

# 36. Telemetry Architecture

The simulated system monitoring component should behave like an external telemetry producer.

Conceptually:

```text
┌─────────────────────┐
│  Telemetry Worker   │
│                     │
│ API latency         │
│ Error rates         │
│ Service status      │
└──────────┬──────────┘
           │
           ▼
      PostgreSQL
           │
           ▼
      Realtime
           │
           ▼
       Dashboard
```

The telemetry worker should not directly manipulate frontend state.

It writes telemetry/state through the appropriate backend boundary, after which the normal database/realtime flow distributes the change.

This keeps the monitoring component replaceable by real telemetry integrations in the future.

---

# 37. Authentication Architecture

The application uses JWT authentication.

Conceptually:

```text
User
 ↓
Application Authentication
 ↓
JWT
 ↓
Authenticated Request
 ↓
Server-side JWT Validation
 ↓
User / Organization Authorization
 ↓
Application
 ↓
PostgreSQL
```

Supabase Auth is not part of this architecture.

Supabase Realtime still participates in the realtime layer, but authentication/authorization must be designed so realtime access respects the same tenant/security boundaries.

The exact mechanism for securely propagating/validating JWT identity through the chosen Supabase Realtime setup must be resolved during implementation architecture.

---

# 38. Multi-Tenant Architecture

Conceptually:

```text
                 Organization
                      │
          ┌───────────┼───────────┐
          │           │           │
        Users       Tickets     Services
          │           │           │
          │           └────┬──────┘
          │                │
          │             Incidents
          │                │
          └────────────────┘
                   │
                Activities
```

Organization ownership must be enforced at trusted backend/database boundaries.

The frontend must never be trusted to provide tenant isolation.

---

# 39. Deployment Architecture

Initial deployment can remain simple:

```text
                 Internet
                    │
                    ▼
               Vercel
                    │
              Next.js App
                    │
                    ▼
               Supabase
             /     |                  /      |               PostgreSQL Realtime  Storage/etc.

                    ▲
                    │
             Telemetry Worker
```

The telemetry worker may eventually run as a separate service/process.

---

# 40. Architectural Principles

These principles should guide all implementation decisions:

1. **PostgreSQL is authoritative.**
2. **Realtime is synchronization, not persistence.**
3. **The server is authoritative over optimistic client state.**
4. **Business rules do not belong exclusively in the UI.**
5. **Authentication and authorization are separate concerns.**
6. **JWT is the authentication mechanism; Supabase Auth is not used.**
7. **Tenant isolation must be enforced server-side/database-side.**
8. **Presence is ephemeral; operational history is persistent.**
9. **Keep the MVP modular, not distributed.**
10. **Prefer simple infrastructure until the product demonstrates a need for more complexity.**
11. **Every feature must have a product reason to exist.**
12. **Do not introduce libraries or infrastructure merely because they are familiar or impressive.**

---

# 41. MVP Acceptance Test

Relay v0.1 is considered functionally successful when the following scenario works reliably.

Open Relay in Browser A and Browser B as two different authorized team members.

### Test 1 — Work

Create a ticket in A.

**B sees it without refreshing.**

### Test 2 — Assignment

Assign the ticket to B.

**B immediately sees the assignment.**

### Test 3 — Incident

Create an incident affecting a service.

**Both dashboards immediately reflect the incident.**

### Test 4 — Impact

Associate multiple tickets with the incident.

**The incident displays its operational impact.**

### Test 5 — Response

Assign the incident to B.

**A sees B as the responder immediately.**

### Test 6 — Service degradation

Simulate the affected service becoming degraded.

**Both dashboards update.**

### Test 7 — Recovery

Restore the service and resolve the incident.

**Both clients converge on the same final state.**

### Test 8 — Disconnect

Kill the network connection.

Relay displays a clear connection-lost state.

Restore the connection.

Relay reconnects and reconciles with authoritative server state.

---

# 42. Handoff to Implementation

This document defines the product, requirements, and high-level system architecture.

The 14 items originally listed here as open have been resolved in **Part II: Implementation Plan** below. Do not skip directly into feature implementation without reading it — in particular §0/§6 there, which pins down the one genuinely non-obvious decision (how Realtime authorization works without Supabase Auth).

---

## Final Architectural Summary

Relay is a **modular monolith** built around a PostgreSQL source of truth.

```text
                         ┌─────────────────────┐
                         │       CLIENT        │
                         │                     │
                         │ Next.js / React     │
                         │ Server Cache        │
                         │ Local UI State      │
                         └──────────┬──────────┘
                                    │
                       HTTPS        │       Realtime
                                    │
                         ┌──────────▼──────────┐
                         │     APPLICATION     │
                         │                     │
                         │ Use Cases           │
                         │ Validation          │
                         │ Authorization       │
                         │ Domain Operations   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │     POSTGRESQL      │
                         │                     │
                         │ Organizations      │
                         │ Users               │
                         │ Tickets             │
                         │ Services            │
                         │ Incidents           │
                         │ Activities          │
                         └──────────┬──────────┘
                                    │
                              DB Changes
                                    │
                         ┌──────────▼──────────┐
                         │ SUPABASE REALTIME   │
                         └──────────┬──────────┘
                                    │
                              Live Updates
                                    │
                              ┌─────┴─────┐
                              ▼           ▼
                           Client A    Client B


             ┌──────────────────────────────┐
             │      TELEMETRY WORKER       │
             │                              │
             │ Simulated service metrics    │
             └──────────────┬───────────────┘
                            │
                            ▼
                       PostgreSQL
```

**Core principle:**

> **Realtime makes Relay feel live. PostgreSQL makes Relay correct.**

---

---

# Part II: Implementation Plan

**Status:** v1.0 — resolves all 14 items from §42, plus the two items §12 and §37 explicitly flagged as open.

This section is written to answer §42's checklist item-by-item, in order, plus §0 up front for the one decision everything else depends on.

---

## 0. The one hard problem this plan has to solve

Supabase Realtime's two subscription modes both assume Supabase Auth by default:

- **Postgres Changes** (subscribe directly to table changes) — authorized via RLS using `auth.uid()`, which only exists for Supabase-Auth-issued JWTs.
- **Broadcast / Presence with private channels** — authorized via **Realtime Authorization**, which _can_ accept a third-party JWT as long as Realtime is configured with the same signing secret and your RLS policies read claims generically (not `auth.uid()`).

Since Relay uses its own JWTs, **Postgres Changes is not a good fit** — we'd have to fight the RLS model. Instead:

> **Decision:** Use Realtime **Broadcast** channels, one per organization (`org:{orgId}`), authorized via Realtime Authorization RLS policies on `realtime.messages` that check a custom JWT claim (`org_id`) instead of `auth.uid()`. The server explicitly broadcasts an event after each committed mutation — clients never read Postgres directly through Realtime.

This resolves §37 and shapes items 6 and 7 below. It also keeps "Realtime is synchronization, not persistence" completely literal: Realtime never touches the database, it just relays a message the server already committed.

**Status: assumption to verify against your actual Supabase project before build starts** — see Open Items.

---

## 1. Data Model & Table Relationships

```
organizations
  id, name, created_at

users
  id, org_id → organizations, email (unique per org), password_hash,
  role (member | manager), created_at

tickets
  id, org_id → organizations, title, description,
  status (open | in_progress | resolved | blocked),
  priority (low | medium | high | urgent),
  assignee_id → users (nullable), creator_id → users,
  version int default 1, created_at, updated_at

services
  id, org_id → organizations, name, description,
  status (operational | degraded | outage),
  latency_ms int, error_rate numeric(5,2),
  version int default 1, updated_at

incidents
  id, org_id → organizations, title, description,
  status (investigating | identified | monitoring | resolved),
  severity (low | medium | high | critical),
  responder_id → users (nullable),
  created_at, resolved_at (nullable),
  version int default 1

incident_services   (incident ↔ service, many-to-many)
  incident_id → incidents, service_id → services, org_id

incident_tickets    (incident ↔ ticket, many-to-many over time)
  incident_id → incidents, ticket_id → tickets, org_id,
  is_active boolean default true, linked_at, unlinked_at (nullable)

activities
  id, org_id → organizations, actor_id → users (nullable — telemetry has no actor),
  action (enum, see README §13), target_type, target_id,
  metadata jsonb, created_at
```

**Cardinality notes (from §8):**

- A ticket may have many `incident_tickets` rows over its life, but at most one with `is_active = true` at a time → enforced with a **partial unique index**, not application logic alone.
- An incident can affect many services and many tickets simultaneously (both true many-to-many).
- Presence is **not a table**. It's handled entirely by Supabase Realtime's Presence primitive (in-memory, per-channel, heartbeat-based expiry) — satisfies §14 ("ephemeral state rather than ordinary persistent database state") with zero extra infrastructure.

---

## 2. Constraints & Indexes

**Constraints**

- All primary keys: UUID, generated server-side (`gen_random_uuid()`).
- Every domain table has a mandatory, non-nullable `org_id` FK — no orphaned or globally-scoped rows are possible.
- Status/priority/severity/role columns: Postgres native `enum` types (not free-text) — invalid states are rejected at the DB layer, not just the app layer, per architectural principle #4 ("business rules do not belong exclusively in the UI").
- `incident_tickets`: `CREATE UNIQUE INDEX one_active_incident_per_ticket ON incident_tickets (ticket_id) WHERE is_active = true;` — DB-level enforcement of "one active incident relationship at a time."
- `tickets`, `services`, `incidents`: `version integer NOT NULL DEFAULT 1` — see §concurrency below.
- No `ON DELETE CASCADE` on domain FKs given the no-deletion policy (§19) — use `ON DELETE RESTRICT` so an accidental delete attempt fails loudly rather than silently cascading through history.

**Indexes**

- `(org_id)` on every domain table — every query is tenant-scoped, this index carries the whole app.
- `(org_id, status)` on tickets, incidents, services — dashboard summary queries filter by status constantly.
- `(org_id, created_at DESC)` on activities — required for pagination (AC-05 says paginate, don't load everything).
- `(assignee_id)` on tickets, `(responder_id)` on incidents — "my work" views.
- `(incident_id)` and `(ticket_id)` on `incident_tickets`; `(incident_id)` and `(service_id)` on `incident_services`.

---

## 3. Tenant Isolation Strategy (replacing RLS-via-Supabase-Auth)

Because there's no Supabase Auth session, classic `auth.uid()`-based RLS isn't available for normal queries (Prisma talks to Postgres directly with a service-level connection string, not per-user browser sessions). Two layers:

**Layer 1 — Application layer (primary, mandatory):**
Every repository function takes `orgId` as a required first parameter, sourced only from the verified JWT on the server — never from client input, never from a route param taken at face value.

```ts
// server/repositories/tickets.ts
export async function listTickets(orgId: string, filters: TicketFilters) { ... }
export async function updateTicketStatus(orgId: string, ticketId: string, ...) { ... }
```

Code-review rule: **no repository function may omit `orgId` as its first argument.** This is the real tenant boundary (AUTH-03, AUTH-05, §38).

**Layer 2 — Database defense-in-depth (deferred for MVP — see Open Items):**
Enable Postgres RLS on domain tables keyed off a session variable set per transaction:

```sql
alter table tickets enable row level security;
create policy tenant_isolation on tickets
  using (org_id = current_setting('app.current_org_id')::uuid);
```

The app would `SET LOCAL app.current_org_id = '<org_id_from_jwt>'` at the start of each transaction. Acceptable to defer given Layer 1 is mandatory and enforced by convention/review; add as a fast-follow rather than a blocker.

**Realtime tenant isolation** is separate — handled in §6 via Realtime Authorization RLS on `realtime.messages`, not on domain tables.

---

## 4. JWT Integration

- **Algorithm:** HS256, single server-held secret (rotate via versioned `kid` if needed later — not MVP).
- **Access token:** short-lived (~15 min), payload: `{ sub: userId, org_id, role, exp }`. Short-lived httpOnly cookie — never localStorage (XSS surface).
- **Refresh token:** longer-lived (~30 days), opaque random value, stored **hashed** in a `refresh_tokens` table (id, user_id, token_hash, expires_at, revoked_at). httpOnly, secure, SameSite=strict cookie. Rotated on every use (old one invalidated) to limit replay damage.
- **Validation:** a single server-side helper (`getSessionFromRequest()`) used by every Server Action and Route Handler (AUTH-06). No component ever parses a JWT itself.
- **Realtime propagation:** on login (and on refresh), mint a **Realtime-scoped JWT** with the same secret and claim shape Realtime's Authorization policies expect (`org_id`, `role`), and call `supabase.realtime.setAuth(token)` client-side before subscribing. Re-minted alongside the normal refresh flow — same identity, just handed to a second consumer (Realtime).

---

## 5. API / Server Boundary

The client never talks to Postgres directly. Two entry points into the application layer, both thin wrappers around the same use-case functions:

- **Server Actions** — default for anything triggered from the Relay web UI (`createTicket`, `assignIncident`, etc.). Colocated with the routes that use them.
- **Route Handlers (`/app/api/...`)** — for callers that aren't the Next.js UI itself. Given the telemetry-worker decision in §13, this is a narrower need than originally scoped — mainly reserved for future external callers.

Neither entry point contains business logic — they parse/validate input (Zod, §11), call a use-case in `server/application/*`, and return a result. Rules live in `server/domain/*`.

---

## 6. Realtime Authorization & Subscription Strategy

Building on §0:

**Channels:** one private channel per organization: `org:{orgId}`. No per-resource channels for MVP.

**Authorization:**

```sql
-- Realtime Authorization policy on realtime.messages
create policy "org members can listen to their org channel"
on realtime.messages for select
using (
  realtime.topic() = 'org:' || (auth.jwt() ->> 'org_id')
);
```

**Client flow:**

1. On session start, client calls `supabase.realtime.setAuth(realtimeJwt)`.
2. Client subscribes to `org:{orgId}` as a **private** channel.
3. Server, after committing any mutation, broadcasts a small event: `{ type: 'ticket.updated', id, orgId }` — an _invalidation hint_, not the full resource (keeps payload small, keeps Realtime non-authoritative — RT-06).

**Presence:** same channel carries Supabase Presence (`track()`/`untrack()` on connect/disconnect) for PR-01/PR-02 — no separate channel or table.

---

## 7. Realtime Event → Query Invalidation Strategy

Given RT-05 (tolerate duplicates) and RT-06 (Realtime is not authoritative): **treat every broadcast as an invalidation signal, never as new state itself.**

```ts
channel.on("broadcast", { event: "ticket.updated" }, ({ payload }) => {
  queryClient.invalidateQueries({ queryKey: ["tickets", payload.id] });
  queryClient.invalidateQueries({ queryKey: ["tickets", "list"] });
});
```

Duplicate/out-of-order events become harmless by construction — an extra invalidation just triggers an extra idempotent refetch.

**Exception — high-frequency telemetry:** debounce `service.updated` invalidations client-side (max ~once per 1–2s per service) to avoid refetch storms; sub-second precision isn't a product requirement.

**Reconnection (§35):** on `SUBSCRIBED` after a reconnect, invalidate _all_ active queries unconditionally — simpler and safer than diffing what was missed.

---

## 8. Optimistic Concurrency (resolving §12)

Every mutable domain table has a `version` column. Every update is conditioned on the version the client last saw:

```sql
update tickets
set status = $1, version = version + 1, updated_at = now()
where id = $2 and org_id = $3 and version = $4;
```

Zero rows affected → the use-case throws a `ConflictError`. The Server Action surfaces this as a typed error; the client's optimistic update rolls back and the affected query is invalidated to reconcile (matches §34's diagram). No locking, no CRDTs — a single atomic conditional `UPDATE` per mutation.

---

## 9. Repository / Module Structure

```
/app                          Next.js App Router routes (presentation only)
  /(dashboard)/...
  /(auth)/login, /register

/server
  /application                Use-cases: createTicket(), assignIncident(), ...
  /domain                     Entities, status enums, transition rules, invariants
  /repositories                Prisma query functions, always org-scoped
  /auth                        JWT sign/verify, session helpers, refresh rotation
  /realtime                    broadcast(orgId, event, payload) helper
  /validation                  Zod schemas (shared with client)

/prisma
  schema.prisma                    Prisma schema definitions
  /migrations

/workers
  telemetry.ts                 Standalone, long-lived telemetry simulator (see §13)

/lib                            Shared client-side utilities (query client, realtime client setup)
```

Rule: a Server Action or Route Handler in `/app` may call `/server/application`, never `/server/repositories` or `/db` directly.

---

## 10. Frontend Architecture

- **Server cache:** TanStack Query owns all server-derived state (tickets, incidents, services, activity, users) — one `QueryClientProvider` at the root.
- **Local UI state:** plain React state for modals, form drafts, filters, selected-row UI — never promoted to a global store.
- **No Zustand** unless a genuine cross-cutting need appears (§26) — none currently anticipated.
- **Realtime wiring:** a single `<RealtimeProvider>` near the root subscribes to `org:{orgId}` once, holds no domain state itself, calls `queryClient.invalidateQueries(...)` per §7.
- **Route structure:** grouped by domain — `/dashboard`, `/tickets`, `/incidents`, `/services`, `/activity` — each with list + detail views. Dashboard composes from the same queries the detail pages use.
- **Optimistic updates:** via TanStack Query `onMutate` for the interactions §34 calls out (status changes, assignment) — not blanket-applied; e.g., ticket _creation_ can wait for server confirmation.

---

## 11. Validation Strategy

- **Single source of truth:** Zod schemas in `/server/validation`, one per use-case input (`createTicketInput`, `assignIncidentInput`, etc.).
- **Server-side:** every Server Action / Route Handler parses input through the matching schema before it reaches the use-case — invalid input never reaches domain logic (org/role checks happen immediately after parsing).
- **Client-side:** the _same_ schemas feed `react-hook-form` via `zodResolver` — avoids two parallel definitions of "what's a valid ticket."
- Domain **invariants** (valid status transitions) live in `/server/domain`, not in the Zod schema — keeps "is this shape valid" separate from "is this business rule satisfied."

---

## 12. Testing Strategy

| Layer                | Tool                                                                             | What it covers                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain               | Vitest                                                                           | Status transition rules, invariants — pure functions, no DB                                                                                                                   |
| Application/use-case | Vitest + a real test Postgres (Testcontainers or a disposable local Supabase DB) | Full use-case behavior: validation → authorization → persistence → activity record, including the version-conflict path                                                       |
| Realtime             | Manual + a thin integration test on the broadcast helper                         | Confirms a committed mutation emits the expected event shape                                                                                                                  |
| End-to-end           | Playwright, **two browser contexts**                                             | Directly implements §41's acceptance test — Browser A mutates, assert Browser B's DOM reflects it without reload, including disconnect/reconnect (`context.setOffline(true)`) |

The Playwright two-context test _is_ the MVP's definition of done — write it early and keep it red until the full path (mutation → commit → broadcast → invalidate → re-render) works end to end.

---

## 13. Telemetry Worker Design

**Decision: standalone, long-lived Node process, calling the application layer in-process — not serverless/cron, not over HTTP.**

Reasoning:

- Serverless/cron is a poor fit for something that needs to tick every few seconds to feel "live" — you'd be fighting execution-time limits and cold starts to fake a loop that's naturally just... a loop.
- Calling a Route Handler over HTTP would require inventing service-auth machinery (a `role: 'system'` JWT, a code path that authorizes a non-human caller) for a component §36 explicitly describes as temporary scaffolding ("keeps the monitoring component replaceable by real telemetry integrations in the future"). Importing the use-case directly gets identical guarantees — same version bump, same activity generation, same broadcast — with zero new auth surface.
- Matches architectural principles #9 ("modular, not distributed") and #10 ("prefer simple infrastructure until the product demonstrates a need for more complexity").

Concretely:

- `/workers/telemetry.ts` — a standalone Node script with a `setInterval` loop, run as its own process (locally via `node`, in production as a small always-on worker alongside the Next.js app — not colocated in the same server process, but not reached over HTTP either).
- Imports from `/server/application` only — **never** `/server/repositories` or `/db` directly. This is the boundary that has to survive when this gets replaced by a real telemetry integration later.
- On each tick, for each service: generates a plausible latency/error-rate delta and calls `updateServiceTelemetry()` — the same use-case a human-triggered path would call. This guarantees the version increment, the activity record on status change (SM-05), and the Realtime broadcast (§6) all happen identically to any other mutation.
- Never creates or resolves Incidents — only ever writes `OPERATIONAL ↔ DEGRADED ↔ OUTAGE` on Services, per §9 ("a human decides").

---

## 14. Development Milestones (Vertical Slices)

Ordered so something real-time and demoable exists as early as possible, then breadth is added:

1. **Foundations** — schema + migrations, JWT auth (login/refresh), org-scoping helper, empty dashboard shell.
2. **Tickets, non-realtime** — create/assign/status/priority CRUD over plain HTTP. Proves the application/domain/repository layering before Realtime enters the picture.
3. **Realtime for tickets** — wire Broadcast + Realtime Authorization + TanStack invalidation for the ticket slice only. First point §41 Tests 1 & 2 can pass — validate the whole realtime pipeline on the simplest entity before extending it.
4. **Services + telemetry worker** — service CRUD/view, worker writing simulated telemetry, SM-01–SM-06, realtime service updates (Test 6).
5. **Incidents + the core relationship** — incident CRUD, incident↔service, incident↔ticket linking (with the partial-unique-index enforcement), realtime propagation (Tests 3–5, 7).
6. **Activity stream** — activity generation wired into every use-case above (retrofit is fine, the transaction pattern in §33 is uniform), paginated view, realtime `activity.created`.
7. **Presence** — online/offline via Realtime Presence, dashboard "who's online" panel.
8. **Reliability pass** — connection-lost UI state, reconnect-and-refetch-all (§35), optimistic-update rollback, version-conflict UX. Exercises §41 Test 8 deliberately.
9. **Dashboard composition** — assemble the unified view (§15) from query hooks built in prior slices; last because it's pure composition, no independent logic.

Each slice from #3 onward should re-run its relevant Playwright acceptance test before moving on, rather than treating testing as a final phase.

---

## Open Items — Status

1. **Realtime Authorization availability** — **still to verify** against the actual Supabase project (plan tier, whether custom-JWT Realtime Authorization is enabled vs. only `auth.uid()`-based Postgres Changes). This is the load-bearing assumption in §0/§6 — verify before Milestone 3.
2. **RLS as defense-in-depth (§3, Layer 2)** — **deferred.** Application-layer org-scoping (Layer 1) is mandatory and treated as the real boundary for MVP; RLS can be added as a fast-follow.
3. **Telemetry worker deployment target** — **resolved.** Long-lived process, in-process calls to the application layer (see §13).
