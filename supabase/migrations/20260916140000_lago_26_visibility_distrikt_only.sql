-- Regression-fix til brief 26 §2 (16. sep 2026):
-- skil distrikt (absolut) fra status (standard) i sælgersynligheden.
--
-- Problem: den nuværende definition blander to forskellige regler:
--
--     is_visible_to_sales := distrikt IN ('Øst','Vest','HQ')
--                        AND COALESCE(is_active, false)
--
-- Konsekvens: "Vis inaktive" på kundelisten kan ikke længere løfte
-- inaktive kunder frem, fordi de allerede er filtreret væk server-side.
-- Prøve: søg "holstebro" med Vis inaktive → 4 kunder (skulle være 7).
-- Vin & Delikatessehuset SPÆRRET (status 9) og Hotel Schaumburg
-- (status 99) kommer aldrig med.
--
-- Løsning: is_visible_to_sales bliver KUN distrikt-baseret. Absolut.
-- Intern, Eksport og distrikt 0 er aldrig synlige — kan ikke slås fra.
-- Status er en STANDARD, ikke en spærring: klient-side filter viser
-- kun visma_statuskode=1 som default, og Vis inaktive løfter det.
--
-- Frontend-ændringer i samme deploy: skærme uden Vis inaktive-toggle
-- (dashboards, felt-flader) tilføjer .eq("is_active", true) eksplicit.
-- Skærme med toggle (LagoCustomerList, SoegPage, felt) har allerede
-- client-side is_active-filter og virker igen af sig selv.

-- Drop det gamle index (afhænger af kolonnen).
DROP INDEX IF EXISTS public.companies_lago_visible_idx;

-- Drop og genopret kolonnen. PostgreSQL tillader ikke ALTER af en
-- generated column's expression — DROP+ADD er den eneste vej.
ALTER TABLE public.companies_lago
    DROP COLUMN IF EXISTS is_visible_to_sales;

ALTER TABLE public.companies_lago
    ADD COLUMN is_visible_to_sales boolean
    GENERATED ALWAYS AS (
        distrikt IN ('Øst', 'Vest', 'HQ')
    ) STORED;

CREATE INDEX companies_lago_visible_idx
    ON public.companies_lago (is_visible_to_sales)
    WHERE is_visible_to_sales = true;

COMMENT ON COLUMN public.companies_lago.is_visible_to_sales IS
  'Brief 26 §2 (rev. 16. sep 2026) · Generated STORED. ABSOLUT synlighed: distrikt IN (Øst,Vest,HQ). Kan ikke slås fra — Intern, Eksport og distrikt 0 er aldrig synlige for sælgere. Status er IKKE del af flaget: klienter filtrerer visma_statuskode=1 som standard og løfter det når Vis inaktive er slået til.';
