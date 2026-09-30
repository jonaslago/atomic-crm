-- LAGO Domain-brief 11 · Sektion 1: settings-tabel til JSON-værdier PO
-- kan redigere i UI'et (fx besøgs-intervaller). Key/value m. jsonb giver
-- os plads til fremtidige indstillinger (kampagnetyper, distrikter …)
-- uden nye migrations.

CREATE TABLE IF NOT EXISTS public.lago_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  bigint REFERENCES public.sales (id) ON DELETE SET NULL
);

INSERT INTO public.lago_settings(key, value)
VALUES (
    'visit_intervals',
    '{"A": 14, "B": 28, "C": 56, "soonRatio": 0.85}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.lago_settings ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read (Dagens/kundelisten skal kunne slå
-- intervals op ved boot).
DROP POLICY IF EXISTS "Authenticated users can read lago_settings"
    ON public.lago_settings;
CREATE POLICY "Authenticated users can read lago_settings"
    ON public.lago_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Skrivning gates via sales.administrator = true. Vi joiner auth.uid()
-- til sales.user_id.
DROP POLICY IF EXISTS "Admins can insert lago_settings"
    ON public.lago_settings;
CREATE POLICY "Admins can insert lago_settings"
    ON public.lago_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update lago_settings"
    ON public.lago_settings;
CREATE POLICY "Admins can update lago_settings"
    ON public.lago_settings
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can delete lago_settings"
    ON public.lago_settings;
CREATE POLICY "Admins can delete lago_settings"
    ON public.lago_settings
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );
