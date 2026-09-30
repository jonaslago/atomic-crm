-- LAGO Domain-brief 18 §3.1 (Jonas' rettelse 10. sep 2026) — plan-tildelt sælger.
--
-- Min dag skal filtrere på "besøg jeg skal udføre", ikke på "kunder
-- jeg ejer". Planlægger kontoret et besøg til Camilla, hører det til
-- på Camillas dag — ikke på min. Kræver at planen har en tildelt
-- sælger, adskilt fra kundens ejer.
--
-- Bootstrap: eksisterende planlagte besøg tildeles kundens ejer
-- (companies.sales_id) så de ikke forsvinder fra Min dag efter deploy.

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS next_visit_planned_by bigint
        REFERENCES public.sales (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_lago_next_visit_planned_by_idx
    ON public.companies_lago (next_visit_planned_by)
    WHERE next_visit_planned_by IS NOT NULL;

-- Bootstrap: eksisterende planer får kundens ejer som fallback.
UPDATE public.companies_lago cl
   SET next_visit_planned_by = c.sales_id
  FROM public.companies c
 WHERE cl.company_id = c.id
   AND cl.next_visit_planned IS NOT NULL
   AND c.sales_id IS NOT NULL
   AND cl.next_visit_planned_by IS NULL;
