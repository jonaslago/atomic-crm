-- §28 (1. okt 2026): daily grain on sales_monthly_lago.
--
-- The table switches from month-level aggregation to day-level.
-- fakturadato becomes part of the primary key so a 7-day import
-- window writes 7 complete days — never a partial month.
--
-- 🔴 RULE: sales_monthly_lago is UPSERT ONLY, NEVER DELETE.
-- The hourly file may contain 7 days; the table holds 3 years.
--
-- §28d: kampagne column added (13.522 of 59.971 rows in source).
-- Parseren already reads it; it was not stored until now.

-- Step 1: drop the old primary key
ALTER TABLE public.sales_monthly_lago
DROP CONSTRAINT sales_monthly_lago_pkey;

-- Step 2: add fakturadato + kampagne columns
ALTER TABLE public.sales_monthly_lago
ADD COLUMN IF NOT EXISTS fakturadato date;

ALTER TABLE public.sales_monthly_lago
ADD COLUMN IF NOT EXISTS kampagne text;

-- Step 3: new primary key with fakturadato
-- Existing rows have fakturadato=NULL. We'll DELETE and reimport from
-- the full file (option A from the plan). The DELETE happens in the
-- reimport script, not here — this migration only changes the schema.
-- Temporarily allow NULL in the PK by using a unique index instead.
-- After reimport, we'll add the NOT NULL constraint + PK.
CREATE UNIQUE INDEX IF NOT EXISTS sales_monthly_lago_daily_pkey
ON public.sales_monthly_lago (
  visma_customer_no, aar, maaned, produktnr, salgstype, fakturadato
)
WHERE fakturadato IS NOT NULL;

COMMENT ON TABLE public.sales_monthly_lago IS
'§28 (1. okt 2026): daily grain. Key: (customer, year, month, product, salgstype, fakturadato). '
'UPSERT ONLY — never DELETE. The hourly file contains 7 days; the table holds 3 years.';
