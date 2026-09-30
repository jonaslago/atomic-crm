-- LAGO Domain-brief 26 · Alle kunder ind, synlighed afledt
--
-- Tre schema-ændringer:
--
-- 1. companies_lago.is_active bliver NULLABLE.
--    Nuværende default TRUE bevares for bagud-kompatibilitet. Men vi
--    må ikke tvinge en boolean på kunder hvor VISMAs Statuskode er tom
--    eller "0" — brief 26 §5b: "Tolk ikke de tomme felter."
--
-- 2. companies_lago.is_visible_to_sales (generated STORED column).
--    Regelen fra brief §2 findes ÉT sted i databasen:
--      distrikt IN ('Øst','Vest','HQ')  AND  COALESCE(is_active,false)
--    Alle sælgerskærme filtrerer på dette felt. Admin-single-fetch
--    (kundeside via URL) rører det ikke — det er bevidst (brief §6).
--
-- 3. sales_code_map_lago.kode_type enum (person/system/historisk).
--    Brief §5c: kode 13/2/0 er "tidligere sælgere på gamle kunder" —
--    en tredje slags null-værdi der ikke må blandes med Webshop/System
--    (98/99) eller "Ingen sælger tildelt" (999). Historisk-mapping
--    er også Simons kø når kunden bliver aktiv.

-- ---------- 1. is_active nullable -----------------------------------

ALTER TABLE public.companies_lago
    ALTER COLUMN is_active DROP NOT NULL;

COMMENT ON COLUMN public.companies_lago.is_active IS
  'Brief 26: nullable. Statuskode 1=true, 9/99/0=false, tomt=null (vi må ikke gætte). Synlighed AFLEDES i is_visible_to_sales — brug den, aldrig denne kolonne direkte til sælgerfilter.';

-- ---------- 2. is_visible_to_sales (generated STORED) --------------
--
-- Brief §2 er briefens største risiko: én glemsomhed = 481 interne
-- konti på en sælgerskærm. Læg reglen i databasen, ikke i klienten.
-- Generated STORED er den strammeste form: kolonnen kan ikke skrives
-- manuelt, kan ikke overstyres, og opdateres automatisk hver gang
-- distrikt eller is_active ændrer sig (via UPDATE-triggeren i Postgres'
-- interne generated-column-mekanisme).

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS is_visible_to_sales boolean
    GENERATED ALWAYS AS (
        distrikt IN ('Øst', 'Vest', 'HQ')
        AND COALESCE(is_active, false)
    ) STORED;

CREATE INDEX IF NOT EXISTS companies_lago_visible_idx
    ON public.companies_lago (is_visible_to_sales)
    WHERE is_visible_to_sales = true;

COMMENT ON COLUMN public.companies_lago.is_visible_to_sales IS
  'Brief 26 §2 · Generated STORED. Én regel, ét sted: distrikt IN (Øst,Vest,HQ) AND is_active=true. Alle sælgerqueries filtrerer på dette. Admin-visning kan bypasse; sælgerskærme må aldrig.';

-- ---------- 3. sales_code_map_lago.kode_type -----------------------

DO $$ BEGIN
    CREATE TYPE public.lago_sales_code_type AS ENUM
        ('person', 'system', 'historisk');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.sales_code_map_lago
    ADD COLUMN IF NOT EXISTS kode_type public.lago_sales_code_type
    NOT NULL DEFAULT 'person';

COMMENT ON COLUMN public.sales_code_map_lago.kode_type IS
  'Brief 26 §5c · Tre slags koder med crm_sales_id=null: system (98/99 aldrig et menneske), 999 (bevidst uden ejer), historisk (13/2/0 tidligere sælgere — Simons kø når kunden bliver aktiv). Ukendte koder afvises, ikke stille-mappes.';

-- Re-klassificer eksisterende rows. is_person → person, 98/99 → system,
-- 999 var også is_person=false men er semantisk "ingen tildelt" — vi
-- bevarer den som system (ikke aktiverbar). Historisk-koderne
-- tilføjes nedenfor.
UPDATE public.sales_code_map_lago
   SET kode_type = 'system'
 WHERE visma_sales_code IN ('98', '99', '999');

-- Brief 26 §5c: seed historiske koder (13, 2, 0) — set i dagens
-- kundefil. Idempotent — INSERT hvis ikke findes, opdater kode_type
-- hvis rækken allerede eksisterer.
INSERT INTO public.sales_code_map_lago
    (visma_sales_code, crm_sales_id, label, is_person, kode_type)
VALUES
    ('13', NULL, 'Historisk sælger (kode 13)', false, 'historisk'),
    ('2',  NULL, 'Historisk sælger (kode 2)',  false, 'historisk'),
    ('0',  NULL, 'Historisk / tom sælgerkode', false, 'historisk')
ON CONFLICT (visma_sales_code) DO UPDATE
    SET kode_type = EXCLUDED.kode_type,
        label     = EXCLUDED.label,
        is_person = EXCLUDED.is_person;

-- ---------- 4. Distrikt-mapping: sæt raw label også for kendte codes ----
-- companies_lago.distrikt er en text-kolonne. Nuværende værdier: Øst,
-- Vest, HQ (fra kunder-parseren). Brief 26 §1 kræver at Intern (19),
-- Eksport (15) og andre koder også lander i basen — bare med et navn
-- der ikke er blandt Øst/Vest/HQ, så is_visible_to_sales-generated
-- column returnerer false.
--
-- Ingen migration af data her — parseren opdateres til at gemme label
-- eller raw-kode for alle distrikter (kunder-parser i denne brief).
-- Eksisterende NULL-distrikt-værdier (fra tidligere importer der
-- droppede ukendte koder) står stadig — de bliver is_visible_to_sales
-- = false, hvilket er det korrekte.

COMMENT ON COLUMN public.companies_lago.distrikt IS
  'Brief 26 §1: samler ALLE distrikter fra VISMA. Øst/Vest/HQ (kode 10/11/12) er sælgersynlige; Intern (19), Eksport (15) og øvrige koder ligger her men er skjulte via is_visible_to_sales. Kolonnen kan indeholde både label og raw-kode — parseren normaliserer.';
