-- Brief 21 (AI-3): audit-trail-felter paa llm_calls saa hvert forslag
-- kan spores til kunden og saelgeren der bad om det, samt hvad udfaldet
-- var (svar / timeout / fejl / ugyldigt_svar). Kaldes fra ai-adapter
-- Edge Function's service_role-klient (bypasser RLS).

ALTER TABLE public.llm_calls
    ADD COLUMN IF NOT EXISTS company_id bigint
        REFERENCES public.companies (id) ON DELETE SET NULL;

ALTER TABLE public.llm_calls
    ADD COLUMN IF NOT EXISTS sales_id bigint
        REFERENCES public.sales (id) ON DELETE SET NULL;

ALTER TABLE public.llm_calls
    ADD COLUMN IF NOT EXISTS outcome text;

CREATE INDEX IF NOT EXISTS llm_calls_company_id_idx
    ON public.llm_calls (company_id)
    WHERE company_id IS NOT NULL;
