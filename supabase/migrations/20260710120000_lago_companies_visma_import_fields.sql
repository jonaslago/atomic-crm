-- LAGO Domain-brief 5: additive columns on companies_lago to support the
-- VISMA XLS import. VISMA-owned operational fields (email, distrikt,
-- betaling, sales code+name) are refreshed on every import. CRM-owned
-- fields (kundestatus) are seeded from VISMA on first import and are
-- authoritative in CRM thereafter — the importer must never overwrite
-- them.
--
-- Everything is additive and backwards-compatible.

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS email               text,
    ADD COLUMN IF NOT EXISTS distrikt            text,
    ADD COLUMN IF NOT EXISTS betaling            text,
    ADD COLUMN IF NOT EXISTS visma_sales_code    text,
    ADD COLUMN IF NOT EXISTS visma_sales_name    text,
    ADD COLUMN IF NOT EXISTS kundestatus         text,
    ADD COLUMN IF NOT EXISTS last_visma_import_at timestamptz;

CREATE INDEX IF NOT EXISTS companies_lago_distrikt_idx
    ON public.companies_lago (distrikt);

CREATE INDEX IF NOT EXISTS companies_lago_visma_sales_code_idx
    ON public.companies_lago (visma_sales_code);
