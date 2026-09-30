-- LAGO Domain-brief 25 Tillæg B · Ordrekategorier rettet + Forbrugt
--
-- Brief B fandt fejlen: rest = Antal − Antal færdigmeldt gjorde alle
-- åbne linjer til "restordre", fordi Antal færdigmeldt er 0 på alle
-- åbne linjer per definition. Kategori-viewet skulle skille tre
-- uafhængige spørgsmål (lager, dato, MAV) — ikke presse dem gennem
-- én kaskade der lod første betingelse vinde.
--
-- Løsning: gem lagerstatus, mav og har_oensket_dato som EGNE felter,
-- og lad kategori beholde sin kaskade for det den kan — de tilstande
-- der reelt udelukker hinanden (fejl / ikke_kundeordre / reservation /
-- en_primeur / normal).
--
-- Plus: Forbrugt (vareforbrug) gemmes både i open_orders_lago og
-- sales_monthly_lago, så dækningsgrad kan beregnes senere uden en
-- genimport af 2½ års historik.

-- ---------- open_orders_lago ----------------------------------------

ALTER TABLE public.open_orders_lago
    ADD COLUMN IF NOT EXISTS reserveret_mod_lager numeric(14, 2),
    ADD COLUMN IF NOT EXISTS lagerstatus          text
        CHECK (lagerstatus IN ('klar','delvis','restordre')),
    ADD COLUMN IF NOT EXISTS mav                  boolean,
    ADD COLUMN IF NOT EXISTS har_oensket_dato     boolean,
    ADD COLUMN IF NOT EXISTS forbrugt             numeric(14, 2);

COMMENT ON COLUMN public.open_orders_lago.reserveret_mod_lager IS
  'Tillæg B: OSRs "Reserveret mod lager"-kolonne. Kilden for lagerstatus. Bevares som rå tal så beregningen kan efterprøves.';

COMMENT ON COLUMN public.open_orders_lago.lagerstatus IS
  'Tillæg B: klar (reserveret_mod_lager ≥ antal) / delvis (0 < r_m_l < antal) / restordre (r_m_l ≤ 0). Beregnes ved import, gemmes så viewet kun læser felter.';

COMMENT ON COLUMN public.open_orders_lago.mav IS
  'Tillæg B: Levering = 1. Boolean fordi det er én af flere ting linjen kan være samtidig.';

COMMENT ON COLUMN public.open_orders_lago.har_oensket_dato IS
  'Tillæg B: oensket_leveringsdato er udfyldt. Boolean fordi det er én af flere ting linjen kan være samtidig — ikke en kaskade-kategori.';

COMMENT ON COLUMN public.open_orders_lago.forbrugt IS
  'Tillæg B: OSRs "Forbrugt"-kolonne. Vareforbrug pr. linje. Ingen visning bygget nu — gemmes så dækningsgrad kan beregnes bagud uden en genimport.';

-- ---------- sales_monthly_lago --------------------------------------

ALTER TABLE public.sales_monthly_lago
    ADD COLUMN IF NOT EXISTS forbrugt numeric(14, 4);

COMMENT ON COLUMN public.sales_monthly_lago.forbrugt IS
  'Tillæg B: aggregeret vareforbrug pr. (kunde × år × måned × produktnr × salgstype). Findes på alle 58.899 historiske fakturalinjer. Ingen visning bygget nu — kolonnen er dækningsgrad-arsenalet.';

-- ---------- v_open_orders_categorised — v5 (Tillæg B) --------------
--
-- Fem-kategori-kaskade (ikke ni). De andre spørgsmål (lager, dato,
-- MAV) læses fra deres egne felter. action_relevant bygger på kategori,
-- ikke på lagerstatus.

DROP VIEW IF EXISTS public.v_open_orders_categorised;
CREATE VIEW public.v_open_orders_categorised AS
SELECT
    oo.ordre_nr,
    oo.linje_nr,
    oo.visma_customer_no,
    cl.company_id,
    c.name                          AS kunde,
    cl.distrikt,
    cl.segment,
    cl.kundetype,
    oo.ordre_dato,
    oo.levering,
    oo.status                       AS ordrestatus,
    oo.kampagne,
    oo.saelger,
    oo.produktnr,
    p.beskrivelse                   AS produktnavn,
    oo.produktgruppe,
    oo.kundeprisgruppe,
    oo.salgstype,
    oo.antal,
    oo.antal_faerdigmeldt,
    oo.rest,
    oo.reserveret_mod_lager,
    oo.forbrugt,
    oo.ej_faktureret                AS beloeb,
    oo.oensket_leveringsdato,
    oo.faerdigmeldingsdato,
    oo.sellerno,
    oo.er_testdata,
    -- Tillæg B: kategori beholder sin kaskade for de tilstande der
    -- reelt udelukker hinanden. Slutter på 'normal', ikke på lager/dato.
    CASE
        WHEN split_part(oo.status, ' ', 1) IN ('11','12','19','20') THEN 'INDKOEB_LAP'
        WHEN split_part(oo.status, ' ', 1) IN ('50','51')            THEN 'fejl'
        WHEN split_part(oo.status, ' ', 1) IN ('23','30')            THEN 'ikke_kundeordre'
        WHEN split_part(oo.levering, ' ', 1) = '5'                   THEN 'reservation'
        WHEN split_part(oo.status,  ' ', 1) = '21'                   THEN 'en_primeur'
        ELSE                                                              'normal'
    END                             AS kategori,
    oo.lagerstatus,
    oo.mav,
    oo.har_oensket_dato,
    -- Tillæg B: action_relevant bygger nu KUN på kategori, ikke på
    -- lager. reservation/ikke_kundeordre/INDKOEB_LAP ude, fejl frem.
    (
        NOT (split_part(oo.status, ' ', 1) IN ('11','12','19','20','23','30'))
        AND NOT (split_part(oo.levering, ' ', 1) = '5')
    )                               AS action_relevant,
    (CURRENT_DATE - oo.ordre_dato)  AS alder_dage
  FROM public.open_orders_lago oo
  LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = oo.visma_customer_no
  LEFT JOIN public.companies      c  ON c.id = cl.company_id
  LEFT JOIN public.products_lago  p  ON p.produktnr = oo.produktnr;

COMMENT ON VIEW public.v_open_orders_categorised IS
    'Tillæg B (v5) · Fem-kategori-kaskade. Lager/dato/MAV læses fra egne felter, ikke fra kaskaden. Svar på "hvad kan sendes nu?" = kategori=normal AND lagerstatus=klar. "Hvad mangler vi varer til?" = lagerstatus=restordre.';

GRANT SELECT ON public.v_open_orders_categorised  TO authenticated;
