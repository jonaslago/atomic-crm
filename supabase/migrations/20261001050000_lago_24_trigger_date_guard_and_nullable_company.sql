-- §24 (1. okt 2026): two prerequisites before next_visit_planned can be
-- replaced by future-dated activities.
--
-- 1. trg_recompute_last_visit_at must exclude future activities.
--    Without `activity_date <= current_date`, inserting a planned visit
--    (activity_date in the future) would set last_visit_at to a future
--    date — the customer vanishes from the call list and counts as
--    up-to-date in the coverage calculation.
--
-- 2. company_id on customer_activities_lago becomes nullable (§94
--    prerequisite). Allows activities not tied to a specific company.

-- 1. Fix trigger: add activity_date <= current_date guard
CREATE OR REPLACE FUNCTION public.trg_recompute_last_visit_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id bigint;
    v_max_date date;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_company_id := OLD.company_id;
    ELSE
        v_company_id := NEW.company_id;
    END IF;

    -- Skip if no company (§94: activities without a customer)
    IF v_company_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Only completed visits (type 1, on or before today) count.
    -- A future-dated activity is a PLAN, not a visit — it must never
    -- reset the visit clock.
    SELECT MAX(a.activity_date)
      INTO v_max_date
      FROM public.customer_activities_lago a
     WHERE a.company_id = v_company_id
       AND a.activity_type_code = 1
       AND a.deleted_at IS NULL
       AND a.activity_date <= current_date;

    UPDATE public.companies_lago cl
       SET last_visit_at = CASE
               WHEN v_max_date IS NULL THEN NULL
               ELSE (v_max_date::text || ' 12:00:00+00')::timestamptz
           END,
           updated_at = now()
     WHERE cl.company_id = v_company_id;

    RETURN NULL;
END;
$$;

-- 2. Make company_id nullable on customer_activities_lago
ALTER TABLE public.customer_activities_lago
    ALTER COLUMN company_id DROP NOT NULL;
