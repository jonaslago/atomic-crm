-- §21 (29. sep 2026): Kan sendes filtrerer på oensket_leveringsdato.
--
-- Ønsket lev. dato er LAGO's AFTALTE dato (ordbogen, rettet 28. sep) —
-- feltnavnet lyver. En ordre med aftalt fremtidig dato er planlagt, ikke
-- ventende. Renes Vin #34929 med 6. okt 2026 var med på Kan sendes
-- fejlagtigt.
--
-- Regel:
--   oensket_leveringsdato IS NULL         → med
--   oensket_leveringsdato <= current_date → med, sortér øverst
--   oensket_leveringsdato > current_date  → ude
--
-- Målt før fix: af 50 ordrer / 39 kunder / 581.666 kr har 19 en fremtidig
-- dato (173.144 kr, 38%). 1 ordre er passeret (3.436 kr). 30 har ingen
-- dato (405.086 kr). Efter fix: 31 ordrer / ~408.522 kr.
--
-- Sortering: har_passeret DESC (passeret først), så beloeb DESC. Passeret
-- er sjældent så den øverste bunke er tydelig når den findes.

CREATE OR REPLACE FUNCTION public.dashboard_kan_sendes_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows          jsonb;
    v_total         int;
    v_total_ordrer  int;
    v_total_beloeb  numeric;
BEGIN
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        o.visma_customer_no,
        BOOL_AND(o.lagerstatus_effective = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdig,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%') AS ikke_ep,
        MIN(o.ordre_dato) AS aeldste_ordredato,
        SUM(COALESCE(o.ej_faktureret, 0)) AS ordre_belob,
        NULLIF(TRIM(MAX(o.note)), '') AS note,
        -- Ønsket dato er ens på alle linjer i ordren; MIN plukker den.
        MIN(o.oensket_leveringsdato) AS oensket_leveringsdato
      FROM public.open_orders_effective_lago o
      WHERE o.er_par_komponent = false
      GROUP BY o.ordre_nr, o.visma_customer_no
    ),
    kunde_ordrer AS (
      SELECT
        of.visma_customer_no,
        of.ordre_nr,
        of.aeldste_ordredato,
        of.ordre_belob,
        of.note,
        of.oensket_leveringsdato,
        -- Passeret-flag pr. ordre; bruges til at bubble ordre-passeret
        -- op til kunden så hun kan sorteres øverst.
        (of.oensket_leveringsdato IS NOT NULL
         AND of.oensket_leveringsdato <= current_date) AS passeret
      FROM ordre_flag of
      WHERE of.all_klar
        AND of.ingen_faerdig
        AND of.levering_nul
        AND of.ikke_mav
        AND of.ikke_ep
        -- §21: aftalt fremtidig dato = ude.
        AND (of.oensket_leveringsdato IS NULL
             OR of.oensket_leveringsdato <= current_date)
    ),
    kunde_agg AS (
      SELECT
        ko.visma_customer_no,
        COUNT(*)::int              AS antal_ordrer,
        SUM(ko.ordre_belob)        AS beloeb,
        MIN(ko.aeldste_ordredato)  AS aeldste_ordredato,
        BOOL_OR(ko.passeret)       AS har_passeret_dato,
        MIN(ko.oensket_leveringsdato) FILTER (WHERE ko.passeret)
                                   AS aeldste_passeret_dato,
        ARRAY_AGG(ko.ordre_nr ORDER BY ko.aeldste_ordredato ASC) AS ordre_numre,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('ordre_nr', ko.ordre_nr, 'note', ko.note)
            ORDER BY ko.ordre_nr
          ) FILTER (WHERE ko.note IS NOT NULL),
          '[]'::jsonb
        ) AS ordre_noter
      FROM kunde_ordrer ko
      GROUP BY ko.visma_customer_no
    ),
    joined AS (
      SELECT
        c.id                      AS company_id,
        c.name                    AS kunde,
        c.sales_id,
        cl.visma_customer_no,
        cl.segment,
        cl.distrikt,
        cl.visma_sales_name,
        cl.kreditspaerre,
        k.antal_ordrer,
        k.beloeb,
        k.aeldste_ordredato,
        k.ordre_numre,
        k.ordre_noter,
        k.har_passeret_dato,
        k.aeldste_passeret_dato,
        -- Passerede kunder først (true=1 > false=0), så beløb DESC.
        row_number() OVER (
          ORDER BY k.har_passeret_dato DESC,
                   k.aeldste_passeret_dato ASC NULLS LAST,
                   k.beloeb DESC,
                   k.aeldste_ordredato ASC,
                   c.name ASC
        ) AS rn
      FROM kunde_agg k
      JOIN public.companies_lago cl ON cl.visma_customer_no = k.visma_customer_no
      JOIN public.companies c ON c.id = cl.company_id
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'company_id',            j.company_id,
            'kunde',                 j.kunde,
            'sales_id',              j.sales_id,
            'visma_customer_no',     j.visma_customer_no,
            'segment',               j.segment,
            'distrikt',              j.distrikt,
            'visma_sales_name',      j.visma_sales_name,
            'kreditspaerre',         j.kreditspaerre,
            'antal_ordrer',          j.antal_ordrer,
            'beloeb',                j.beloeb,
            'aeldste_ordredato',     j.aeldste_ordredato,
            'ordre_numre',           to_jsonb(j.ordre_numre),
            'ordre_noter',           j.ordre_noter,
            'har_passeret_dato',     j.har_passeret_dato,
            'aeldste_passeret_dato', j.aeldste_passeret_dato
          )
          ORDER BY j.har_passeret_dato DESC,
                   j.aeldste_passeret_dato ASC NULLS LAST,
                   j.beloeb DESC,
                   j.aeldste_ordredato ASC,
                   j.kunde ASC
        ) FILTER (WHERE j.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int,
      COALESCE(SUM(j.antal_ordrer), 0)::int,
      COALESCE(SUM(j.beloeb), 0)
    INTO v_rows, v_total, v_total_ordrer, v_total_beloeb
    FROM joined j;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total,
      'total_ordrer', v_total_ordrer,
      'total_beloeb', v_total_beloeb
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_kan_sendes_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_kan_sendes_lago(int) TO authenticated;
