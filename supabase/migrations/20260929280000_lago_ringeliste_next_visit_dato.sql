-- §22 opfølgning (29. sep 2026): to ting samtidig.
--
-- (a) Reglen. En planlagt dato i fortiden er ikke en plan — det er et
--     hul der holder kunden ude af kontorets liste. Ringeliste-reglen
--     ændres:
--       Før: next_visit_planned IS NULL
--       Efter: next_visit_planned IS NULL OR next_visit_planned::date < current_date
--     Effekt: 141 → 142 (ReesesFlasker føjes til).
--
-- (b) Årsagen. Rydningen skal ske, når besøget faktisk sker — uanset om
--     det kommer fra CRM-registrering, PlanVisitDialog eller VISMA-
--     importen. Ny trigger på customer_activities_lago rydder
--     next_visit_planned når en Besøg-aktivitet (activity_type_code=1)
--     med activity_date <= current_date indsættes/opdateres, og den
--     tidligere plan var på samme dag eller før. Det dækker alle tre
--     skrivere; registrerBesoeg's eksplicitte rydning i mutations.ts
--     bliver som ekstra sikkerhed.
--
-- (c) Dato ikke tidspunkt. Alle sammenligninger caster til ::date, ét
--     sted (RPC-viewet). Klienten arver samme regel.
--
-- (d) Engangs-oprydning. Nuværende fortidige planer nulstilles så
--     hullerne lukkes én gang.

-- ---------------------------------------------------------------------
-- Trigger: ryd next_visit_planned når et besøg registreres på samme
-- dag eller senere end den planlagte dato.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_clear_next_visit_on_besoeg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Kun besøgsaktiviteter (kode 1) på/før i dag rydder planen.
    -- Fremtidige aktiviteter er selve planen — importen sætter dem.
    IF NEW.activity_type_code = 1
       AND NEW.activity_date <= current_date
       AND NEW.deleted_at IS NULL
    THEN
        UPDATE public.companies_lago
           SET next_visit_planned      = NULL,
               next_visit_note         = NULL,
               next_visit_planned_by   = NULL,
               updated_at              = now()
         WHERE company_id = NEW.company_id
           AND next_visit_planned IS NOT NULL
           AND next_visit_planned::date <= NEW.activity_date;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lago_clear_next_visit_on_besoeg
    ON public.customer_activities_lago;
CREATE TRIGGER lago_clear_next_visit_on_besoeg
    AFTER INSERT OR UPDATE ON public.customer_activities_lago
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_clear_next_visit_on_besoeg();

COMMENT ON FUNCTION public.trg_clear_next_visit_on_besoeg IS
'§22 opfølgning (29. sep 2026): en Besøg-aktivitet (activity_type_code=1) på/før i dag rydder companies_lago.next_visit_planned hvis planen var på samme dag eller før. Dækker CRM-native, PlanVisitDialog og VISMA-import. Fanger hullet der holdt ReesesFlasker og Kokkens Vinhus ude af ringelisten.';

-- ---------------------------------------------------------------------
-- Engangs-oprydning: fjern alle fortidige planer der ikke længere er
-- planer. Rydningen matcher triggerens regel — der er allerede en
-- besøgsaktivitet på/efter dato, ellers ville planen stadig være aktiv.
-- ---------------------------------------------------------------------

UPDATE public.companies_lago
   SET next_visit_planned      = NULL,
       next_visit_note         = NULL,
       next_visit_planned_by   = NULL,
       updated_at              = now()
 WHERE next_visit_planned IS NOT NULL
   AND next_visit_planned::date < current_date;

-- ---------------------------------------------------------------------
-- RPC: dashboard_ringeliste_lago — ny regel.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dashboard_ringeliste_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows              jsonb;
    v_total             int;
    v_total_overdue     int;
    v_total_never       int;
BEGIN
    WITH candidates AS (
      SELECT
        c.id,
        c.name,
        c.city,
        c.sales_id,
        cl.segment,
        cl.distrikt,
        cl.last_visit_at,
        cl.visma_sales_name,
        cl.besoegsfrekvens_note,
        vp.status,
        vp.days_overdue,
        CASE cl.segment WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 END
          AS segment_rank
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp
        ON vp.company_id = cl.company_id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        -- §22 opfølgning: fortidig plan er ikke en plan.
        AND (cl.next_visit_planned IS NULL
             OR cl.next_visit_planned::date < current_date)
        AND (
          (vp.status = 'overdue' AND vp.days_overdue >= 14)
          OR vp.status = 'never_visited'
        )
    ),
    ranked AS (
      SELECT c.*,
             row_number() OVER (
               ORDER BY days_overdue DESC NULLS LAST,
                        segment_rank ASC,
                        name ASC
             ) AS rn
      FROM candidates c
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'city', r.city,
            'sales_id', r.sales_id,
            'segment', r.segment,
            'distrikt', r.distrikt,
            'last_visit_at', r.last_visit_at,
            'visma_sales_name', r.visma_sales_name,
            'days_overdue', r.days_overdue,
            'interval_days', NULL,
            'besoegsfrekvens_note', r.besoegsfrekvens_note,
            'status', r.status
          )
          ORDER BY r.days_overdue DESC NULLS LAST,
                   r.segment_rank ASC,
                   r.name ASC
        ) FILTER (WHERE r.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int,
      count(*) FILTER (WHERE r.status = 'overdue')::int,
      count(*) FILTER (WHERE r.status = 'never_visited')::int
    INTO v_rows, v_total, v_total_overdue, v_total_never
    FROM ranked r;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total,
      'total_overdue', v_total_overdue,
      'total_never_visited', v_total_never
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_ringeliste_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_ringeliste_lago(int) TO authenticated;
