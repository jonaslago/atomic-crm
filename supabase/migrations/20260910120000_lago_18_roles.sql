-- LAGO Domain-brief 18 §1 — rollemodel.
-- Ny enum lago_role + kolonne på sales + trigger der holder Atomic's
-- administrator-flag i synk. Bootstrap: eksisterende admins får rollen
-- så de ikke taber adgang.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lago_role') THEN
        CREATE TYPE public.lago_role AS ENUM ('saelger', 'kontor', 'ledelse', 'admin');
    END IF;
END $$;

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS lago_role public.lago_role NOT NULL DEFAULT 'saelger';

CREATE INDEX IF NOT EXISTS sales_lago_role_idx ON public.sales (lago_role);

CREATE OR REPLACE FUNCTION public.sync_lago_role_to_administrator()
RETURNS trigger AS $$
BEGIN
    IF NEW.lago_role = 'admin' THEN
        NEW.administrator := TRUE;
    ELSIF (TG_OP = 'UPDATE' AND OLD.lago_role = 'admin' AND NEW.lago_role <> 'admin') THEN
        NEW.administrator := FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_lago_role_admin_sync ON public.sales;
CREATE TRIGGER sales_lago_role_admin_sync
    BEFORE INSERT OR UPDATE OF lago_role ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_lago_role_to_administrator();

UPDATE public.sales
   SET lago_role = 'admin'
 WHERE administrator = TRUE
   AND lago_role = 'saelger';
