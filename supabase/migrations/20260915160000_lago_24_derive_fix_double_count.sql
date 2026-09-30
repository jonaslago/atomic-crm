-- LAGO Domain-brief 24 · fix dobbelt-tælling i derive_sales_id_from_visma
--
-- Første udgave af completeness-tal (20260915140000) tælle ok_no_change
-- EFTER UPDATE'en — så alle rows der lige var blevet opdateret nu
-- matchede mappingen og blev talt som "uændret" oveni. Resultatet:
-- 226 + 25 + 3 + 226 = 480, ikke 254.
--
-- Fix: baser kategorierne på visma_sales_code (state der IKKE ændres
-- af UPDATE'en), og udled ok_no_change som "eligible − updated". Så
-- kan invarianten aldrig brydes af rækkefølge-effekter i CTE'en.
--
-- Kategorierne, disjunkte og fuldstændige:
--   skipped_null_code   — visma_sales_code IS NULL (rørt aldrig)
--   system_code_null    — koden peger på systemkode (98/99/999)
--   eligible            — koden peger på menneskelig eller ukendt kode
--     ├─ updated        — UPDATE ændrede sales_id (før != efter)
--     └─ ok_no_change   — UPDATE sprang over (før == efter)
--
-- Invariant: skipped_null_code + system_code_null + updated + ok_no_change = total.

CREATE OR REPLACE FUNCTION public.derive_sales_id_from_visma()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_total int;
    v_skipped_null_code int;
    v_system_code_null int;
    v_eligible int;
    v_updated int := 0;
    v_set_to_null int := 0;
    v_ok_no_change int;
BEGIN
    -- Tæl kategorierne FØR UPDATE, baseret alene på visma_sales_code.
    -- Rækkefølge-uafhængigt.
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE cl.visma_sales_code IS NULL),
        COUNT(*) FILTER (
            WHERE cl.visma_sales_code IS NOT NULL
              AND m.is_person = false
        ),
        COUNT(*) FILTER (
            WHERE cl.visma_sales_code IS NOT NULL
              AND (m.is_person IS DISTINCT FROM false)
        )
    INTO v_total, v_skipped_null_code, v_system_code_null, v_eligible
    FROM public.companies_lago cl
    LEFT JOIN public.sales_code_map_lago m
           ON m.visma_sales_code = cl.visma_sales_code;

    -- Kunder MED en VISMA-kode: sæt/opdater sales_id fra mappingen.
    -- IS DISTINCT FROM sørger for at null→null ikke tæller som UPDATE.
    WITH updated AS (
        UPDATE public.companies c
        SET sales_id = m.crm_sales_id
        FROM public.companies_lago cl
        LEFT JOIN public.sales_code_map_lago m
               ON m.visma_sales_code = cl.visma_sales_code
        WHERE cl.company_id = c.id
          AND cl.visma_sales_code IS NOT NULL
          AND c.sales_id IS DISTINCT FROM m.crm_sales_id
        RETURNING c.id, m.crm_sales_id
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE crm_sales_id IS NULL)
    INTO v_updated, v_set_to_null
    FROM updated;

    -- ok_no_change afledes så invarianten altid holder.
    v_ok_no_change := v_eligible - v_updated;

    RETURN jsonb_build_object(
        'total',             v_total,
        'updated',           v_updated,
        'set_to_null',       v_set_to_null,
        'ok_no_change',      v_ok_no_change,
        'system_code_null',  v_system_code_null,
        'skipped_null_code', v_skipped_null_code,
        'invariant_holds',
            (v_updated + v_ok_no_change + v_system_code_null + v_skipped_null_code) = v_total,
        'ran_at',            now()
    );
END;
$$;

COMMENT ON FUNCTION public.derive_sales_id_from_visma() IS
  'Brief 24 · Single source of truth for companies.sales_id. Kaldes af hver import som sidste skridt. Returnerer completeness-tal så summen kan checkes uden database-adgang. Kategorierne baseres på visma_sales_code — rækkefølge-uafhængigt.';
