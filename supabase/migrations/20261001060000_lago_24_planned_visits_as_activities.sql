-- §24 (1. okt 2026): planned visits become real activities.
--
-- next_visit_planned is replaced by querying the nearest future
-- visit activity (activity_type_code=1, activity_date > today,
-- done=false, deleted_at IS NULL).
--
-- Columns next_visit_planned, next_visit_note, next_visit_planned_by
-- are NOT dropped — they remain as facit until Jonas verifies in week 42.
--
-- This migration:
--   1. Creates v_next_planned_visit_lago view
--   2. Migrates existing plans to activities
--   3. Drops the trigger trg_clear_next_visit_on_besoeg (no longer needed)

-- 1. View: nearest future visit per customer
CREATE OR REPLACE VIEW public.v_next_planned_visit_lago AS
SELECT DISTINCT ON (a.company_id)
    a.company_id,
    a.activity_date AS planned_at,
    a.description   AS planned_note,
    a.sales_id      AS planned_by_sales_id,
    a.id            AS activity_id
FROM public.customer_activities_lago a
WHERE a.activity_type_code = 1
  AND a.activity_date > current_date
  AND a.done = false
  AND a.deleted_at IS NULL
ORDER BY a.company_id, a.activity_date ASC;

COMMENT ON VIEW public.v_next_planned_visit_lago IS
'§24 (1. okt 2026): nearest future visit per customer, derived from customer_activities_lago. Replaces companies_lago.next_visit_planned column (which is kept but no longer read by the application).';

GRANT SELECT ON public.v_next_planned_visit_lago TO authenticated;

-- 2. Migrate existing plans to activities.
-- 11 rows as of 1. okt 2026. Fortid-planer (<=today) get done=true.
INSERT INTO public.customer_activities_lago (
    company_id, activity_date, activity_type_code, activity_type,
    description, done, sales_id, source
)
SELECT
    cl.company_id,
    cl.next_visit_planned::date,
    1,
    'Besøg',
    cl.next_visit_note,
    cl.next_visit_planned::date <= current_date, -- past plans = done
    cl.next_visit_planned_by,
    'crm_native'
FROM public.companies_lago cl
WHERE cl.next_visit_planned IS NOT NULL
  -- Skip if an activity already exists for this company on the same date
  -- (idempotency guard for re-running this migration)
  AND NOT EXISTS (
    SELECT 1 FROM public.customer_activities_lago a
    WHERE a.company_id = cl.company_id
      AND a.activity_date = cl.next_visit_planned::date
      AND a.activity_type_code = 1
      AND a.source = 'crm_native'
      AND a.deleted_at IS NULL
  );

-- 3. Drop the trigger that clears next_visit_planned when a visit is
-- registered. The column is no longer read; the trigger has no purpose.
DROP TRIGGER IF EXISTS lago_clear_next_visit_on_besoeg
    ON public.customer_activities_lago;
DROP FUNCTION IF EXISTS public.trg_clear_next_visit_on_besoeg();
