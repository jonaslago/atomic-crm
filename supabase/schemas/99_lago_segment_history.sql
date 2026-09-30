-- LAGO Import-brief 5b — segment-klassificerings-historik.
--
-- Én række pr. gang en kunde faktisk klassificeres (A/B/C). Første
-- kørsel = baseline for "kunder der skifter kategori"-visualiseringen og
-- fremtidige kapacitets-tjek. X-rækker (uklassificerede) skrives ikke;
-- fravær af række = kunden er endnu ikke klassificeret.
--
-- Unique-index på (visma_customer_no, klassificeret_dato, grundlag) gør
-- gen-kørsel af den samme baseline til no-op — samme dato + samme
-- grundlag skriver ikke en ny række.
--
-- Additivt, LAGO-only. Ingen upstream-tabeller rørt.

CREATE TABLE IF NOT EXISTS public.lago_segment_history (
    id                  bigserial PRIMARY KEY,
    company_id          bigint NOT NULL
                        REFERENCES public.companies (id) ON DELETE CASCADE,
    visma_customer_no   text NOT NULL,
    segment             text NOT NULL
                        CHECK (segment IN ('A', 'B', 'C', 'X', 'L')),
    klassificeret_dato  date NOT NULL,
    grundlag            text NOT NULL,
    t12m_belob          numeric(14, 2),
    vaekst_pct          numeric(6, 1),
    retning             text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lago_segment_history_uniq_idx
    ON public.lago_segment_history (visma_customer_no, klassificeret_dato, grundlag);

CREATE INDEX IF NOT EXISTS lago_segment_history_company_idx
    ON public.lago_segment_history (company_id);

CREATE INDEX IF NOT EXISTS lago_segment_history_dato_idx
    ON public.lago_segment_history (klassificeret_dato);

ALTER TABLE public.lago_segment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read lago_segment_history"
    ON public.lago_segment_history;
CREATE POLICY "Authenticated users can read lago_segment_history"
    ON public.lago_segment_history
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert lago_segment_history"
    ON public.lago_segment_history;
CREATE POLICY "Authenticated users can insert lago_segment_history"
    ON public.lago_segment_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update lago_segment_history"
    ON public.lago_segment_history;
CREATE POLICY "Authenticated users can update lago_segment_history"
    ON public.lago_segment_history
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete lago_segment_history"
    ON public.lago_segment_history;
CREATE POLICY "Authenticated users can delete lago_segment_history"
    ON public.lago_segment_history
    FOR DELETE
    TO authenticated
    USING (true);
