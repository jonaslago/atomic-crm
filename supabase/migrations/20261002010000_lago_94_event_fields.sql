-- §94 (2. okt 2026): Event as activity — four new fields + migration.
--
-- Event replaces Smagning. Same activity_type_code (10), new label.
-- No new table. No calendar module. No separate screen.
--
-- Fields:
--   title       — "Vinmesse", "Roséfestival" (optional, for events)
--   attendees   — free text: who from LAGO was/will be there
--   event_status — 'planlagt' | 'afholdt' | 'aflyst' (only for events)
--   location    — optional free text (events aren't always at the customer)

ALTER TABLE public.customer_activities_lago
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS attendees text,
    ADD COLUMN IF NOT EXISTS event_status text
        CHECK (event_status IS NULL OR event_status IN ('planlagt', 'afholdt', 'aflyst')),
    ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.customer_activities_lago.title IS
'§94: event title — "Vinmesse", "Roséfestival". Optional, primarily for events.';

COMMENT ON COLUMN public.customer_activities_lago.attendees IS
'§94: free text — who from LAGO was or will be at the event. Not a relation.';

COMMENT ON COLUMN public.customer_activities_lago.event_status IS
'§94: planlagt/afholdt/aflyst. Only meaningful for events (activity_type_code=10). NULL for other types.';

COMMENT ON COLUMN public.customer_activities_lago.location IS
'§94: free text — where the event takes place. An event is not always at the customer.';

-- Migration: Smagning/Promotion (code 10) → Event
-- Count before: 41 rows (measured 2. okt 2026)
UPDATE public.customer_activities_lago
SET activity_type = 'Event',
    event_status = CASE
        WHEN done = true THEN 'afholdt'
        WHEN cancelled = true THEN 'aflyst'
        ELSE 'planlagt'
    END
WHERE activity_type_code = 10
  AND deleted_at IS NULL;
