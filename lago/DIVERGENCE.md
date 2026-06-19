# Upstream divergence log

Single source of truth for every place this fork knowingly differs from
`marmelab/atomic-crm`. Each entry must explain **why** the divergence is
unavoidable and **what to re-check** when pulling a fresh upstream.

## Stewardship rules

1. All LAGO customisation should go through `<CRM>` props,
   extension points, or new files under `src/lago/...` (runtime) and
   `lago/...` (docs/config). Modifying any file under
   `src/components/atomic-crm/`, `src/components/admin/`, or
   `src/components/ui/` requires an entry here.
2. Before pulling upstream changes:
   - `git fetch upstream`
   - `git merge-tree $(git merge-base HEAD upstream/main) HEAD upstream/main`
     (or `git merge --no-commit --no-ff upstream/main`, then `git merge --abort`)
   - If conflicts appear in any divergence entry's file: review that
     entry, decide whether the divergence is still needed, and update.
3. Remove an entry as soon as the divergence is reverted.

## Current divergences

### `src/App.tsx`

- **Type:** documented configuration point (not a true divergence).
- **Why:** Upstream's own jsdoc tells consumers to customise the app by
  passing props to `<CRM>`. We pass `disableTelemetry` and
  `i18nProvider={lagoI18nProvider}`.
- **Re-check on upstream merge:** if upstream adds new mandatory `<CRM>`
  props, mirror them here.

### `src/components/atomic-crm/root/CRM.tsx`

- **Type:** additive extension points — added optional `companyShow?: ComponentType` and `companyList?: ComponentType` props to `CRMProps`, plumbed through to both `DesktopAdmin` and `MobileAdmin` so they override the default `companies` Resource show/list components when provided.
- **Why:** Domain-briefs 1 + 2 (kerne-kundebillede and prioritised customer list) need fully LAGO-shaped components, and upstream's `<CRM>` exposed no per-resource override hooks. The changes are small and backwards-compatible (default behaviour unchanged when props are omitted); we mirror the same prop pattern for both views.
- **Re-check on upstream merge:** if upstream itself adds `companyShow` / `companyList` props with different semantics, reconcile. If upstream refactors the `<Resource name="companies" ...>` registration, re-thread the props. Consider upstreaming these hooks as a PR.

### `supabase/config.toml`

- **Type:** additive — new `[functions.ai-adapter]` block appended after
  upstream's per-function configs.
- **Why:** Per-function `verify_jwt` is the only place this can be configured.
  Adding a new block is additive (no merge conflict unless upstream itself
  ships an `ai-adapter` function, which they will not).
- **Re-check on upstream merge:** if upstream adds more per-function blocks
  near the end of the file, ensure our `[functions.ai-adapter]` block stays
  intact and after them.

