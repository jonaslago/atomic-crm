-- §11 opfølgning (29. sep 2026) · par-detektion flyttet til basen.
--
-- Historisk lå par-detektionen i useOpenOrders.ts (visningslaget) —
-- kundekortet så pakken 91814-BY som klar (fordi komponentens reservation
-- blev overtaget), forsidens Kan sendes-widget så den som restordre (læste
-- lagerstatus direkte). Ordre 34868 er det læselige eksempel: hovedvaren
-- er en undtages=true-pakke, lagerlinjen er den parrede komponent med
-- reservation men 0 kr.
--
-- Reglen ligger nu i basen som view. Både kundekortet og widget'et læser
-- det samme; visningslaget kan ikke længere have sin egen mening.
--
-- Par-reglen (målt i produktion 29. sep 2026 · 3 SKU'er 36 linjer 37/37):
--   Salgsvare  = undtages_lagerhaandtering = true AND ej_faktureret > 0
--                AND antal > 0
--   Komponent  = undtages_lagerhaandtering = false AND ej_faktureret = 0
--                AND reserveret_mod_lager > 0 AND antal > 0
--   Match      = samme ordre_nr AND samme split_part(produktnr, '-', 1)
--                AND samme antal
--   Præcis 1   = én komponent-kandidat pr. salgsvare OG én salgsvare-
--                kandidat pr. komponent (ingen tvetydighed)
--   Effekt     = komponentens reservation gælder salgsvaren; komponenten
--                skjules fra visningslaget

CREATE OR REPLACE VIEW public.open_orders_effective_lago AS
WITH salgsvarer AS (
    SELECT
        ordre_nr,
        linje_nr,
        produktnr,
        split_part(produktnr, '-', 1) AS prefix,
        antal,
        reserveret_mod_lager
    FROM public.open_orders_lago
    WHERE undtages_lagerhaandtering = true
      AND ej_faktureret > 0
      AND antal > 0
),
komponenter AS (
    SELECT
        ordre_nr,
        linje_nr,
        produktnr,
        split_part(produktnr, '-', 1) AS prefix,
        antal,
        reserveret_mod_lager
    FROM public.open_orders_lago
    WHERE undtages_lagerhaandtering = false
      AND ej_faktureret = 0
      AND reserveret_mod_lager > 0
      AND antal > 0
),
-- Præcis 1: én komponent-kandidat pr salgsvare, samme retning tilbage.
sv_match_count AS (
    SELECT
        s.ordre_nr, s.linje_nr, s.prefix, s.antal,
        (SELECT COUNT(*) FROM komponenter k
          WHERE k.ordre_nr = s.ordre_nr
            AND k.prefix = s.prefix
            AND k.antal = s.antal) AS komp_kandidater
    FROM salgsvarer s
),
komp_match_count AS (
    SELECT
        k.ordre_nr, k.linje_nr, k.prefix, k.antal, k.reserveret_mod_lager,
        (SELECT COUNT(*) FROM salgsvarer s
          WHERE s.ordre_nr = k.ordre_nr
            AND s.prefix = k.prefix
            AND s.antal = k.antal) AS sv_kandidater
    FROM komponenter k
),
par AS (
    SELECT
        s.ordre_nr,
        s.linje_nr AS sv_linje,
        k.linje_nr AS komp_linje,
        k.reserveret_mod_lager AS overtag_res
    FROM sv_match_count s
    JOIN komp_match_count k
      ON k.ordre_nr = s.ordre_nr
     AND k.prefix   = s.prefix
     AND k.antal    = s.antal
    WHERE s.komp_kandidater = 1
      AND k.sv_kandidater  = 1
)
SELECT
    o.*,
    -- Reservation efter par-detektion. Salgsvarer i par overtager
    -- komponentens reserveret_mod_lager. Alle andre linjer bruger deres
    -- egen værdi (eller 0 hvis NULL).
    COALESCE(
        (SELECT p.overtag_res FROM par p
          WHERE p.ordre_nr = o.ordre_nr AND p.sv_linje = o.linje_nr),
        o.reserveret_mod_lager,
        0
    ) AS reserveret_effective,
    -- Lagerstatus efter par-detektion. Klar, hvis reservation (efter par)
    -- er >= antal. Delvis hvis > 0. Restordre ellers.
    CASE
      WHEN COALESCE(
             (SELECT p.overtag_res FROM par p
               WHERE p.ordre_nr = o.ordre_nr AND p.sv_linje = o.linje_nr),
             o.reserveret_mod_lager, 0
           ) >= o.antal THEN 'klar'
      WHEN COALESCE(
             (SELECT p.overtag_res FROM par p
               WHERE p.ordre_nr = o.ordre_nr AND p.sv_linje = o.linje_nr),
             o.reserveret_mod_lager, 0
           ) > 0 THEN 'delvis'
      ELSE 'restordre'
    END AS lagerstatus_effective,
    -- Komponent-linje i et par → skjules fra visningslaget. Klientens
    -- gamle detektPar-funktion satte samme flag i en Set; nu er det en
    -- kolonne alle læsere ser.
    EXISTS (
      SELECT 1 FROM par p
       WHERE p.ordre_nr = o.ordre_nr AND p.komp_linje = o.linje_nr
    ) AS er_par_komponent
FROM public.open_orders_lago o;

COMMENT ON VIEW public.open_orders_effective_lago IS
'§11 opfølgning (29. sep 2026): open_orders_lago plus par-detektion. Både kundekortet og widget''et læser reserveret_effective og lagerstatus_effective her; ingen kopi af reglen i visningslaget. er_par_komponent=true → skjul linjen (dens reservation er allerede overtaget af salgsvaren).';

GRANT SELECT ON public.open_orders_effective_lago TO authenticated;
