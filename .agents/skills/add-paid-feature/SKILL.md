---
name: add-paid-feature
description: Use when introducing a new optional paid feature to the master Orbit template. Covers registering it in features.json, adding it to PAID_FEATURES + FEATURE_KEYS, wiring CLI flags + interactive prompts, and gating the code with fence markers. MASTER REPO ONLY.
---

# Adding a new paid feature

A "feature" in Orbit is anything the user can opt out of at scaffold time. Paid features additionally gate which template repo the CLI clones (private, post-purchase). So adding one means changing TWO places that declare paid-ness, plus the CLI surface, plus the strip manifest.

## Steps

### 1. Update `packages/create-orb/src/args.ts`

- Append the key to the `FeatureKey` union type
- Append to the `FEATURE_KEYS` array
- If paid: add to the `PAID_FEATURES` Set
- If the feature has provider sub-features (e.g. Stripe vs Polar), add a `<Name>ProviderChoice` union, a `<NAME>_PROVIDER_CHOICES` array, and a `normalize<Name>Provider()` helper
- Add a `--<name>=yes|no` branch to `parseArgs()`
- Add the flag to `HELP_TEXT`

### 2. Declare the feature in `features.json`

```jsonc
"<name>": {
  "name": "<name>",
  "tier": "paid",
  "label": "Human-readable label",
  "description": "What it does, what disappears when off.",
  "defaultEnabled": true,
  "requires": [],
  "files": ["apps/api/src/<context>/", ...],
  "fencedRegions": [/* files with inline fences */],
  "envKeys": ["FOO_API_KEY", ...]
}
```

Sub-features (provider choices) declare `requires: ["<parent>"]` and `defaultEnabled: false`. The chosen provider is enabled by the CLI. Canonical pattern: see `billing-stripe`, `billing-polar`, `billing-dodo`.

### 3. Add an interactive prompt

Edit `packages/create-orb/src/prompts.ts`. Follow the existing Clack prompt pattern — group related features, surface paid-tier callouts where the user is making a tier-affecting choice.

### 4. Fence the code

Wrap every new region with `// +feature:<name>` / `// -feature:<name>`. Use the `add-feature-fence` skill for syntax details. Don't forget:

- API code (controllers, services, repositories)
- Drizzle tables in `apps/api/src/db/drizzle/schema.ts` (use `// +feature:` line comments)
- Frontend pages + routes
- DTOs in `packages/shared/src/dto.ts`
- Permission entries in `packages/shared/src/permissions.ts`
- Composition wiring in `apps/api/src/composition.ts`
- Router wiring in `apps/api/src/interfaces/http/router.ts`

### 5. Test both tiers

```bash
npm run build:starter              # builds the public free-tier starter
```

- With the feature on: code stays
- With the feature off: code stripped + env keys removed from every `.env.example`

## Sub-features (mutually exclusive choices)

If the feature has a provider choice (e.g. Stripe / Polar / Dodo, graphile / qstash), declare a parent feature plus one sub-feature per choice. The parent has `options.<choice>.choices = [...]`, and the chosen sub-feature is enabled while the others are stripped.

## Sanity check

- `hasPaidSelection({ "<feature>": true })` returns `true`
- The CLI prompt offers it
- `--<feature>=no` strips the code cleanly (no orphan imports, typecheck passes)
- The public starter (`npm run build:starter`) does NOT contain the new code
