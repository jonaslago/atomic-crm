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

*(No other core-file divergences as of fork creation 2026-06-19.)*
