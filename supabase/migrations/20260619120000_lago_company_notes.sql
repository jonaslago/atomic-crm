-- LAGO: company-level notes side-car for the kerne-kundebillede.
-- Hand-written to keep the migration scoped to LAGO-only DDL.

CREATE TABLE IF NOT EXISTS public.company_notes_lago (
    id          bigserial PRIMARY KEY,
    company_id  bigint NOT NULL
                REFERENCES public.companies (id) ON DELETE CASCADE,
    contact_id  bigint
                REFERENCES public.contacts (id) ON DELETE SET NULL,
    text        text NOT NULL,
    sales_id    bigint
                REFERENCES public.sales (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_notes_lago_company_id_created_at_idx
    ON public.company_notes_lago (company_id, created_at DESC);

ALTER TABLE public.company_notes_lago ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
    ON TABLE public.company_notes_lago TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
    ON TABLE public.company_notes_lago TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
    ON TABLE public.company_notes_lago TO service_role;

-- ditto on the sequence so authenticated inserts can read currval
GRANT USAGE, SELECT ON SEQUENCE public.company_notes_lago_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.company_notes_lago_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.company_notes_lago_id_seq TO service_role;

CREATE POLICY "Authenticated users can read company_notes_lago"
    ON public.company_notes_lago FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert company_notes_lago"
    ON public.company_notes_lago FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update company_notes_lago"
    ON public.company_notes_lago FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete company_notes_lago"
    ON public.company_notes_lago FOR DELETE TO authenticated USING (true);
