---
name: add-feature-fence
description: Use when adding new code to the master Orbit template that should only ship to projects that opted into a specific feature. Covers picking the right fence syntax (TS / JSX), updating features.json, and verifying the strip pass works. MASTER REPO ONLY — do not invoke in scaffolded projects.
---

# Adding a feature fence

Code without a fence ships in **every** scaffolded output, including the free public starter. If new code belongs to a paid (or any optional) feature, it MUST be wrapped in fence markers.

## Pick the syntax

Three forms, all equivalent — match the file context:

| Where | Syntax |
|---|---|
| `.ts` (incl. `db/drizzle/schema.ts`), single-line | `// +feature:<name>` … `// -feature:<name>` |
| Multi-line `.ts` block comment | `/* +feature:<name> */` … `/* -feature:<name> */` |
| Inside JSX | `{/* +feature:<name> */}` … `{/* -feature:<name> */}` |

The strip regex is `^\s*//\s*[+|-]feature:<name>\s*$` (and equivalents). Both markers MUST live on their own line.

## Steps

1. **Confirm the feature exists** in `features.json`. If not, run the `add-paid-feature` skill first.
2. **Wrap the new code** with the chosen fence form.
3. **Document the file** in `features.<name>.fencedRegions` in `features.json`. The strip engine walks the whole repo so this is advisory, but it tells other contributors where fences live.
4. **Verify** by running `npm run build:starter`. The output in `starter/` must NOT contain the fenced code (when the feature is paid/off in the starter build).

## Examples

```ts
// +feature:audit-log
import { AuditProjector } from "@/audit/application/audit-projector.ts";
// -feature:audit-log
```

```ts
// apps/api/src/db/drizzle/schema.ts
// +feature:audit-log
export const appAuditEntries = pgTable("app_audit_entries", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
});
// -feature:audit-log
```

```tsx
{/* +feature:billing */}
<BillingPanel />
{/* -feature:billing */}
```

## Common mistakes

- **Trailing comment on the marker line** breaks the regex. Markers stand alone.
- **Same-name nested fences** throw — different sub-feature names are fine.
- **Fencing the import but not the usage** (or vice versa) — both must move together or stripped output fails to typecheck.
- **Forgetting the closing marker** — startup scan throws on unbalanced fences.
