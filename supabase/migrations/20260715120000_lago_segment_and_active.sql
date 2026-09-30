-- LAGO Domain-brief 13 — unified segment/status.
--
-- 1) Segment bor kun i CRM: udvid CHECK til A/B/C/X/L, default X.
-- 2) Aktiv/inaktiv kommer fra VISMAs Statuskode: nyt is_active bool +
--    visma_statuskode int så det er sporbart.
-- 3) Oprydning: nulstil rig kundestatus (Gruppe 2) — droppes helt.
--    Tidligere seedet segment holdes hvis A/B/C; alt andet → X.
--    (Der var ~5 rækker med Onsight-segment, så intet reelt tabt.)

-- 1) Udvid segment-CHECK. Drop den gamle constraint først.
ALTER TABLE public.companies_lago
    DROP CONSTRAINT IF EXISTS companies_lago_segment_check;

-- Fjern default først (så vi kan ændre typen)
ALTER TABLE public.companies_lago
    ALTER COLUMN segment DROP DEFAULT;

-- Normalisér eksisterende værdier: alt der ikke er A/B/C bliver X.
UPDATE public.companies_lago
   SET segment = 'X'
 WHERE segment IS NULL OR segment NOT IN ('A', 'B', 'C', 'X', 'L');

ALTER TABLE public.companies_lago
    ADD CONSTRAINT companies_lago_segment_check
    CHECK (segment IN ('A', 'B', 'C', 'X', 'L'));

ALTER TABLE public.companies_lago
    ALTER COLUMN segment SET DEFAULT 'X';

-- 2) Aktiv/inaktiv fra VISMA Statuskode.
ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS visma_statuskode int,
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS companies_lago_is_active_idx
    ON public.companies_lago (is_active);

-- 3) Ryd rig kundestatus (Gruppe 2 "Status"-kolonnen) — droppes helt.
UPDATE public.companies_lago
   SET kundestatus = NULL
 WHERE kundestatus IS NOT NULL;

-- Sørg for at alle rækker uden segment ender som X (paranoia efter
-- rebuild — default DEFAULT dækker fremtidige inserts).
UPDATE public.companies_lago
   SET segment = 'X'
 WHERE segment IS NULL;
