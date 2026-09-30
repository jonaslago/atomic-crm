-- LAGO: settings key/value table (Domain-brief 11).

CREATE TABLE IF NOT EXISTS public.lago_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  bigint REFERENCES public.sales (id) ON DELETE SET NULL
);

ALTER TABLE public.lago_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read lago_settings"
    ON public.lago_settings;
CREATE POLICY "Authenticated users can read lago_settings"
    ON public.lago_settings
    FOR SELECT
    TO authenticated
    USING (true);

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
