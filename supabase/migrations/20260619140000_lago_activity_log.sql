-- LAGO: combined activity feed view (upstream activity_log + LAGO
-- company_notes_lago). Hand-written to keep the migration LAGO-only.

CREATE OR REPLACE VIEW public.lago_activity_log AS
SELECT
    al.id,
    al.type,
    al.date,
    al.company_id,
    al.sales_id,
    al.company,
    al.contact,
    al.deal,
    al.contact_note,
    al.deal_note,
    NULL::json AS company_note
FROM public.activity_log al
UNION ALL
SELECT
    ('companyNote.' || cnl.id::text || '.created') AS id,
    'companyNote.created'::text AS type,
    cnl.created_at AS date,
    cnl.company_id,
    cnl.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note,
    to_json(cnl.*) AS company_note
FROM public.company_notes_lago cnl;

GRANT SELECT ON public.lago_activity_log TO anon;
GRANT SELECT ON public.lago_activity_log TO authenticated;
GRANT SELECT ON public.lago_activity_log TO service_role;
