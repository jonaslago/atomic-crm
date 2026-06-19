-- LAGO: audit trail for every AI call going through the ai-adapter Edge Function.
-- New file under supabase/schemas/ — additive only, never touches upstream's
-- numbered files, so upstream merges stay conflict-free.

CREATE TABLE IF NOT EXISTS public.llm_calls (
    id                bigserial PRIMARY KEY,
    provider          text NOT NULL,
    model             text NOT NULL,
    prompt_version    text NOT NULL,
    input_tokens      integer,
    output_tokens     integer,
    latency_ms        integer,
    cost_estimate_dkk numeric(10, 4),
    user_id           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_calls_created_at_idx
    ON public.llm_calls (created_at DESC);

CREATE INDEX IF NOT EXISTS llm_calls_user_id_idx
    ON public.llm_calls (user_id);

ALTER TABLE public.llm_calls ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read only their own call rows. Inserts happen via
-- service_role from the Edge Function and bypass RLS — no INSERT/UPDATE/DELETE
-- policy is defined for authenticated/anon users, which (with RLS enabled)
-- blocks them by default.
DROP POLICY IF EXISTS "Users read their own AI calls" ON public.llm_calls;
CREATE POLICY "Users read their own AI calls"
    ON public.llm_calls
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
