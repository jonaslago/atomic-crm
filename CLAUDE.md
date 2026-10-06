@AGENTS.md

# Tool Usage — Mandatory Rules

These rules are absolute. They apply to every session, every agent, every command.

## 1. Never use Bash for file search or reading

- **File search by name:** use `Glob`, never `find` or `ls`
- **Content search:** use `Grep`, never `grep`, `rg`, or `ag` in Bash
- **Read files:** use `Read`, never `cat`, `head`, `tail`, or `sed`

Bash is for building, deploying, running migrations, and system commands only.

## 2. Paths in double quotes, never backslash-escaped

- Wrong: `/Users/jonasarild/Documents/Claude/Projects/LAGO\ CRM/atomic-crm/...`
- Right: `"/Users/jonasarild/Documents/Claude/Projects/LAGO CRM/atomic-crm/..."`

## 3. No shell tricks that break permission matching

- Never use `2>/dev/null` in Bash commands
- Never combine `cd <path> && <command>` — use tool-specific flags instead:
  - `git -C "<path>"` instead of `cd "<path>" && git ...`
  - `npx --prefix "<path>"` or `npx supabase --workdir "<path>"` instead of `cd && npx`
- Both `cd && ...` and `2>/dev/null` make commands unanalysable for the permission matcher, forcing manual approval on every call

## 4. Never run destructive tests against production

- Success-path tests that delete/replace data: run against a copy (`CREATE TABLE _test_x AS SELECT * FROM x`), never the real table
- Failure-path tests (that roll back) are safe in production
- When something is empty or deleted, say it on the first line — not as a footnote

## 5. Every new table gets RLS + policy in the same migration

A helper table from a migration inherits no RLS. `CREATE TABLE` +
`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` in the same file —
not afterwards, when Supabase sends a security advisory.

A table without RLS in public is readable and writable by anyone with
the project URL and the anon key. The repo is public.

## 6. Secrets never appear in terminal output, commits, .env or conversation

Generate → write to file → set via `secrets set` → delete file.
Never `echo`, never inline in a command, never print. The repo is public.

## 7. Missing values are shown as missing

- `null` fields display as "Ingen frist", "—", or blank — never filled with `new Date()`, `0`, or any computed placeholder that looks like a real value
- A fallback that appears valid is fabricated data on a screen people act on

# Agent Workflow

This project ships CRM changes through a coordinated agent team rather than a single implementer. Once a plan is approved (via `ExitPlanMode`), the main thread / orchestrator does not implement directly — it routes the work to the custom agents defined under `.claude/agents/`. Each agent's full contract lives in its own file; this section is the map of who does what, and in which order.

## Routing: SIMPLE vs COMPLEX

The **chat-orchestrator** is the user-facing entry point. It routes, narrates progress, and never implements. It classifies each request:

- **SIMPLE** — one cosmetic edit, OR a single-field change on an existing entity (schema + view + type + form + show), OR one list filter that reuses existing components (no new custom React component). Dispatched straight to a **simple-developer** + **merger** — no team, no peer review. `SubagentStop` hooks validate; a deploy-time migration round runs only if a migration was written.
- **COMPLEX** — everything else. Goes through the full planner → wave → review → merge pipeline below.

## COMPLEX pipeline

1. **planner** — decompose the approved plan into atomic, ordered tickets (JSON) with best-guess file paths and dependency waves. Skip only when the plan is already a single atomic deliverable (one file, one fix, one migration).
2. **developer** (one per ticket) — implement + commit inside the ticket's git worktree. Tickets in the same wave (`parallel_safe: true`, no mutual dependency) are spawned concurrently as **foreground** subagents — a single message with multiple `Agent(...)` tool uses (no `run_in_background`); the orchestrator's turn resumes once they all return. Developers also write an ADR under `adr/` when a change introduces a structural decision, and never write SQL migrations (those are generated at deploy time).
3. **quality-reviewer** + **test-validator** (per ticket, in parallel) — quality-reviewer does combined semantic code + security review; test-validator checks integration wiring and e2e presence. Neither re-runs validation (hooks already do).
4. **merger** — `git merge --no-ff` only; never `git add` / `git commit`. One merger is dispatched per ticket (Stage A: feature branch → session branch); a final promotion merger (`MODE: promote`) moves the session branch onto `main` once the wave is done, serialised across sessions by a `flock` on the shared `.git`.
5. **documentator** — auto-runs at the end of every COMPLEX session, appending business knowledge to `MEMORY.md` from the session diff. (Mode 1 also captures reusable rules/skills on explicit user request.)

There is no cross-agent messaging: the orchestrator dispatches every agent as a **foreground subagent** (`Agent(...)`, no `run_in_background`) and drives the wave **synchronously within one continuous turn** (chat-orchestrator.md STATE B) — a foreground call blocks until the subagent returns, and several in one message run concurrently and return together. Each wave flows through three barriered stages: develop (concurrent) → review + bounded retry (concurrent) → merge (sequential, since per-ticket mergers share the session branch). This replaces an earlier event-driven background model, which stalled when a background completion woke the wrong subagent instead of the orchestrator. Each agent's last output line is an **output contract** (`DONE: …` / `FAILED: …` / `APPROVED` / `REJECTED: …`) that the orchestrator parses to choose the next dispatch (see `.claude/rules/agent-output-format.md`). PreToolUse/Agent hooks prepare the worktree (`setup-worktree`) and gate the flow (`enforce-dev-dispatch`, `block-merger-without-review`, `block-promote-unmerged`); SubagentStop hooks validate (`validate-on-stop`) and record review verdicts (`record-review-verdict`).

## Agent team

| Agent | Model | Role |
|---|---|---|
| chat-orchestrator | sonnet | User-facing. Routes, narrates. SIMPLE flow dispatches simple-developer + merger directly (no team). |
| planner | sonnet | Decomposes the plan into tickets JSON with waves + file hints. |
| developer | opus | Implements + commits in a worktree. Applies the **Ponytail** minimization ladder (full mode) automatically on every ticket, via an inline prompt directive. Writes ADRs for structural decisions. Never writes SQL migrations (deploy-time only). |
| simple-developer | sonnet | One cosmetic edit, one single-field entity change, or one filter reusing existing components. Applies the **Ponytail** ladder (full mode) automatically, via an inline prompt directive. No team, no review. |
| quality-reviewer | sonnet | Combined semantic code + security review only. Never re-runs validation. |
| test-validator | haiku | Integration wiring + e2e presence. |
| merger | haiku | `git merge --no-ff` only. Never `git add` / `git commit`. |
| documentator | sonnet | Mode 1 — captures rules/skills on request. Mode 2 — appends business knowledge to `MEMORY.md` at COMPLEX session end. |

Only **developer** runs on opus; everything else is sonnet or haiku.

The **developer** and **simple-developer** apply the **Ponytail** minimization ladder (full mode) on every change, via inline directives in their prompts — the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed **natively** in-repo as on-demand skills (no plugin, no marketplace, no hooks): its skills live in `.claude/skills/ponytail*` and its `/ponytail*` commands in `.claude/commands/`, for interactive use in the main session (`/ponytail-review`, `/ponytail-audit`, …). These do not affect the dev agents, whose ladder comes from the inline directives above.

## The orchestrator's job between hand-offs

Relay agent reports, surface blockers, and stop to ask the user whenever an agent flags an open question or a `FAILED` outcome the orchestrator can't resolve. (A reviewer `REJECTED` verdict is handled silently by the bounded developer-retry loop, not surfaced to the user.) Do not bypass this flow for "small-looking" changes — the trigger is *plan approved*, not *task size*. Direct requests that never entered plan mode are not subject to this workflow.

## Supporting rules

The mechanics each agent must follow live in `.claude/rules/`:

- **worktree-scope** — every ticket agent works only inside its own worktree; never read/edit the base-branch checkout. Covers session-branch topology and the merge path.
- **agent-output-format** — the structured-text contract every agent returns.
- **validation-commands** — typecheck / prettier / unit / e2e are automated by hooks; agents must not run them manually.
- **security-triggers** — when a change warrants extra security scrutiny.

Claude Code hooks (configured in `.claude/settings.json`, stored in `.claude/hooks/`) must be written as `.mjs` files (ES modules).
