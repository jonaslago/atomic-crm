-- LAGO Domain-brief 6 prep: brief 5 only stored Kundenr as
-- visma_customer_no, but the contact export links contacts to customers
-- via VISMA Aktørnr (Kundenr is empty on contacts). Add an additive
-- column so the contact importer can resolve links with a simple join.
--
-- Backfill happens in the next kunde re-import run — the importer will
-- fill visma_aktoer_nr for every row on its next pass.

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS visma_aktoer_nr text;

CREATE UNIQUE INDEX IF NOT EXISTS companies_lago_visma_aktoer_nr_key
    ON public.companies_lago (visma_aktoer_nr)
    WHERE visma_aktoer_nr IS NOT NULL;
