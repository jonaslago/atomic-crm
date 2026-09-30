-- LAGO Domain-brief 12 · Fase B: additive lat/lng + geokodnings-status
-- på companies_lago så kortet (Fase C) kan tegne pins direkte.
--
-- `address_hash` er MD5 af det normaliserede adresse-input, så batchen
-- kan se hvornår adressen har ændret sig og re-geokode. `status` giver
-- Settings-widgeten et hurtigt overblik over hvor mange kunder der
-- mangler koordinater.

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS lat                 double precision,
    ADD COLUMN IF NOT EXISTS lng                 double precision,
    ADD COLUMN IF NOT EXISTS geocode_status      text
        CHECK (geocode_status IS NULL
               OR geocode_status IN ('found', 'not_found', 'error')),
    ADD COLUMN IF NOT EXISTS geocode_source      text,
    ADD COLUMN IF NOT EXISTS geocoded_address    text,
    ADD COLUMN IF NOT EXISTS geocoded_address_hash text,
    ADD COLUMN IF NOT EXISTS geocoded_at         timestamptz;

CREATE INDEX IF NOT EXISTS companies_lago_lat_lng_idx
    ON public.companies_lago (lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_lago_geocode_status_idx
    ON public.companies_lago (geocode_status);
