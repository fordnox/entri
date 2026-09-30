---
name: add-audit-event
description: Use when wiring a domain event into the audit log so it appears in the workspace or app ledger. Covers editing audit-event-mapper.ts, picking the right ledger (App vs Workspace), the optional team-narrowing path, action-string conventions, and adding the integration test case.
---

# Wiring a domain event into the audit log

The audit log is materialized by a post-commit projector. The single function `mapEventToAudit(event)` decides which ledger an event lands in. To make a new event auditable, register a factory in `apps/api/src/audit/application/audit-event-mapper.ts`.

## Pick the ledger

- **`AppAuditEntry`** — global admin-only. For platform-wide moderation actions: bans, impersonations, force-deletions across tenants. Read by app admins only.
- **`WorkspaceAuditEntry`** — tenant-scoped. The default for almost everything: member changes, role edits, billing state, team lifecycle. Optionally narrowed to a team via `teamId`.
- **Both** — fan-out is supported. An app admin force-deleting a workspace should appear in the global log AND the tenant's log.

## Steps

### 1. Confirm the domain event is published

The event class (e.g. `TeamCreated` from `apps/api/src/teams/domain/team.ts`) must already be emitted by the originating service via `tx.events.add(...)`. The projector only sees events that go through the bus.

### 2. Open `apps/api/src/audit/application/audit-event-mapper.ts`

### 3. Import the event class (fenced if from a paid feature)

```ts
```

### 4. Register a factory

```ts
WORKSPACE_MAPPERS.set("teams.team.created", (event) => {
  const e = event as TeamCreated;
  return {
    workspaceId: e.workspaceId,
    teamId: e.teamId,                 // optional team narrow
    actorMemberId: e.createdById,
    actorUserId: null,
    action: "team.created",           // dotted action taxonomy
    targetType: "team",
    targetId: e.teamId,
    occurredAt: e.occurredAt,         // event time, not now
  };
});
```

- `WORKSPACE_MAPPERS` for tenant ledger
- `APP_MAPPERS` for global ledger
- Set both for fan-out

### 5. Action string conventions

Format: `<noun>.<verb-past-tense>`. Examples: `team.created`, `member.role_changed`, `billing.subscription_updated`. The action is the column shown in the UI ledger — keep it terse and consistent. Prefer reusing an existing noun over inventing a new one.

### 6. Metadata

`metadata` flows through `sanitizeMetadata()` automatically — tokens and secrets are redacted, emails and IDs are kept. Pass any JSON-safe object that helps customer support reconstruct the action later.

### 7. Add a test case

In `apps/api/src/__tests__/audit.integration.test.ts`. Publish the event through a real service, assert the entry was written to the right ledger with the right shape.

## Common mistakes

- **Forgetting to fence the import** when the source event is from a paid feature (`teams`, `billing`, etc.). Without the fence, `mapEventToAudit` won't compile in stripped builds.
- **Using `actorUserId` for member actions**. Workspace ledgers prefer `actorMemberId` (workspace-scoped) so the audit log can render the member's display name even after the user leaves. Use `actorUserId` only for app-admin actions where no member context exists.
- **Skipping `occurredAt`** or using `clock.now()` instead. Always pass the event's own `occurredAt` — the audit row should match when the action happened, not when the projector ran.
