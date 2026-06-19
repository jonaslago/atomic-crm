# LAGO ai-adapter (Fase 0 del B)

Provider-agnostic Edge Function that gates every AI call going through the CRM.

## Layout

```
prompts/                                 # CANONICAL prompts (edit here)
├── hello.v1.md                          # role.version.md, with frontmatter
lago/
├── sync-prompts.mjs                     # regenerates the runtime .ts modules
supabase/
├── schemas/99_lago_llm_calls.sql        # audit table definition
├── migrations/20260619064040_lago_llm_calls.sql
├── functions/
│   └── ai-adapter/                      # Edge Function (NOT "claude-adapter")
│       ├── index.ts                     # entry, request/response
│       ├── types.ts                     # AIProvider interface
│       ├── audit.ts                     # writes to public.llm_calls
│       ├── pricing.ts                   # model → DKK rates (rough estimate)
│       ├── promptLoader.ts              # looks up bundled prompts by key
│       ├── providers/anthropic.ts       # one provider, swappable
│       └── prompts/                     # GENERATED .ts modules (do not edit)
│           ├── index.ts
│           └── hello.v1.ts
```

## Why prompts live in two places

The brief says "/prompts/ as data, versioned, never hardcoded". Supabase
Edge Functions only bundle `.ts` files at compile time — Deno cannot read
arbitrary `.md` files from the function directory at runtime. So:

- `/prompts/*.md` is the **canonical, human-editable** source.
- `supabase/functions/ai-adapter/prompts/*.ts` is **generated** from the .md
  files by `node lago/sync-prompts.mjs`. Committed so the function bundles
  reliably; never edit by hand.

**Always re-run `node lago/sync-prompts.mjs` after editing any prompt.**

## Adding a new prompt

1. Create `prompts/{role}.{version}.md` with frontmatter:
   ```
   ---
   role: my_role
   version: v1
   model: claude-haiku-4-5
   max_output_tokens: 500
   temperature: 0
   description: One-line description
   ---
   The system prompt body...
   ```
2. Run `node lago/sync-prompts.mjs`.
3. Commit both the `.md` and the generated `.ts` (+ updated `index.ts`).

## Calling the function

```
POST /functions/v1/ai-adapter
Headers:
  content-type: application/json
  apikey: <supabase anon or service key>
  authorization: Bearer <user JWT>     # optional — supplies user_id to audit
Body:
  { "role": "hello", "version": "v1", "input": "<user input>" }

Response 200:
  { "text", "provider", "model", "prompt_version",
    "usage": { "input_tokens", "output_tokens", "latency_ms" },
    "cost_estimate_dkk" }
```

Every successful call writes one row to `public.llm_calls`.

## Local dev

The function needs `ANTHROPIC_API_KEY` to be present at serve time. Start
the functions runtime with the LAGO secrets file:

```
npx supabase functions serve --env-file supabase/functions/.env.local
```

`supabase/functions/.env.local` is gitignored — never commit a real key.

## Future swaps

- New provider (e.g. OpenAI): drop a `providers/openai.ts` that implements
  `AIProvider`, add a request field to choose provider, route in `index.ts`.
  No prompt or schema change needed.
- New model from same provider: just bump `model:` in the prompt frontmatter
  and add a row to `pricing.ts` if the model wasn't priced yet.
