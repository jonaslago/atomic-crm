-- LAGO: companies_lago side-car (Fase 1 first slice).
-- Hand-written (not from `supabase db diff`) to keep the migration scoped to
-- LAGO-only DDL — diff would re-emit drift grants on unrelated upstream tables.

CREATE TABLE IF NOT EXISTS public.companies_lago (
    company_id          bigint PRIMARY KEY
                        REFERENCES public.companies (id) ON DELETE CASCADE,
    visma_customer_no   text UNIQUE,
    segment             text CHECK (segment IS NULL OR segment IN ('A', 'B', 'C')),
    last_visit_at       timestamptz,
    next_visit_planned  timestamptz,
    opening_hours       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_lago_visma_no_idx
    ON public.companies_lago (visma_customer_no);

CREATE INDEX IF NOT EXISTS companies_lago_segment_idx
    ON public.companies_lago (segment);

ALTER TABLE public.companies_lago ENABLE ROW LEVEL SECURITY;

-- Grants follow the upstream-wide pattern (broad grants; RLS does the gating).
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
    ON TABLE public.companies_lago TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
    ON TABLE public.companies_lago TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
    ON TABLE public.companies_lago TO service_role;

CREATE POLICY "Authenticated users can read companies_lago"
    ON public.companies_lago FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert companies_lago"
    ON public.companies_lago FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies_lago"
    ON public.companies_lago FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies_lago"
    ON public.companies_lago FOR DELETE TO authenticated USING (true);
