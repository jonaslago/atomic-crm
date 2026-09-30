-- LAGO Domain-brief 18 §1 — rollemodel (saelger/kontor/ledelse/admin).
--
-- Behold Atomic CRM's egen `administrator boolean` på public.sales —
-- upstream-kode bruger den til rettigheder og RLS. Fjerner vi den,
-- brækker forken. De to lever side om side.
--
-- Regel: lago_role = 'admin' skal sætte administrator = true,
-- ikke omvendt. En upstream-admin er ikke nødvendigvis en LAGO-admin.
-- Håndhæves via trigger nedenfor.

CREATE TYPE public.lago_role AS ENUM ('saelger', 'kontor', 'ledelse', 'admin');

ALTER TABLE public.sales
    ADD COLUMN lago_role public.lago_role NOT NULL DEFAULT 'saelger';

CREATE INDEX sales_lago_role_idx ON public.sales (lago_role);

-- Trigger: hold administrator-flaget i synk med lago_role='admin'.
-- Kun én-vejs: sætter lago_role → admin, opdateres administrator til true.
-- Fjerner vi admin-rollen, sætter vi administrator til false — MEN
-- guardrail nede i updateSalesAdministrator forhindrer allerede sidste
-- aktive admin i at blive fjernet, så vi risikerer ikke lockout.
CREATE OR REPLACE FUNCTION public.sync_lago_role_to_administrator()
RETURNS trigger AS $$
BEGIN
    IF NEW.lago_role = 'admin' THEN
        NEW.administrator := TRUE;
    ELSIF (TG_OP = 'UPDATE' AND OLD.lago_role = 'admin' AND NEW.lago_role <> 'admin') THEN
        -- Nedgradér: hvis en tidligere LAGO-admin bliver noget andet,
        -- fjern også upstream-admin-flaget (så de to holdes i synk).
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

-- Bootstrap: eksisterende administrator-brugere får lago_role='admin'
-- så CRM-admins fra før denne migration ikke pludselig taber deres
-- LAGO-admin-adgang.
UPDATE public.sales
   SET lago_role = 'admin'
 WHERE administrator = TRUE
   AND lago_role = 'saelger';  -- kun default-værdien; rør ikke manuelt satte
