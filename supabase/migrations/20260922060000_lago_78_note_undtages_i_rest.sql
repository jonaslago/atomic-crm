-- Brief 78 · tillæg A (22. sep 2026)
--
-- Tre datafejl fundet ved at læse VISMA-udtrækket direkte:
--
--  1. `Undtages lagerhåndtering = 1`-filteret droppede kundens prissatte
--     linjer. AEvin #34696·1 (91801-Jul, 3.163,80 kr.) forsvandt; kun
--     komponenten (91801, 0 kr., 8 reserveret) blev importeret. 64 af
--     1.979 rækker i 22-sep-udtrækket har flaget sat.
--
--  2. `rest = Antal − Antal færdigmeldt` var altid lig Antal fordi LAGO
--     aldrig dellevererer på samme ordre (dellevering = ny ordre). Den
--     nye formel er VISMAs egen: `rest = Antal − Reserveret mod lager`.
--     Tallet bliver identisk med det, kontoret ser.
--
--  3. `Note`-kolonnen (ordre-note, fx "Portvinspakke 2026 - rest") var
--     aldrig blevet importeret. Den er udfyldt på 82 % af linjerne og
--     er den bedste enkeltoplysning en sælger kan få.

ALTER TABLE public.open_orders_lago
    ADD COLUMN IF NOT EXISTS note text,
    ADD COLUMN IF NOT EXISTS undtages_lagerhaandtering boolean
        NOT NULL DEFAULT false;

COMMENT ON COLUMN public.open_orders_lago.note IS
    'Brief 78 tillæg A §3 (22. sep 2026): OSRs "Note"-kolonne — ordrens '
    'formål (fx "Portvinspakke 2026 - rest"). Ens på alle linjer i samme '
    'ordre. Vises i ordrens hoved, ikke pr. linje.';

COMMENT ON COLUMN public.open_orders_lago.undtages_lagerhaandtering IS
    'Brief 78 §1 (22. sep 2026): rå værdi fra "Undtages lagerhåndtering". '
    'Brief 25 tillæg B filtrerede den ud af importen; det droppede kundens '
    'prissatte linje (AEvin #34696·1 "91801-Jul" 3.163,80 kr). Nu importeres '
    'alle linjer; par-håndtering (salgsvare + komponent på samme ordre) '
    'sker i visnings-laget.';

-- Genberegn rest for eksisterende data med VISMAs egen formel, så
-- visningen viser rigtige tal FØR næste sync. Næste import overskriver
-- via samme formel.
UPDATE public.open_orders_lago
   SET rest = COALESCE(antal, 0) - COALESCE(reserveret_mod_lager, 0)
 WHERE antal IS NOT NULL;
