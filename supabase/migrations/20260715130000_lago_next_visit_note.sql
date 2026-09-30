-- Brief 15 (FS-20 · Planlæg besøg): additive kolonne for et valgfrit
-- "hvad vil jeg"-notat der følger den planlagte booking. Ryddes sammen
-- med next_visit_planned når et besøg registreres. Idempotent.

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS next_visit_note text;
