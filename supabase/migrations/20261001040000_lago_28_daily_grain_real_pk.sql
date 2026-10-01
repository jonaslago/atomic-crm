-- §28 fix: replace partial unique index with a real primary key.
-- PostgREST's upsert requires an actual constraint, not a partial index.
-- All rows now have fakturadato NOT NULL (reimport completed 1. okt).

-- Drop the partial index
DROP INDEX IF EXISTS public.sales_monthly_lago_daily_pkey;

-- Make fakturadato NOT NULL
ALTER TABLE public.sales_monthly_lago
ALTER COLUMN fakturadato SET NOT NULL;

-- Add the real primary key
ALTER TABLE public.sales_monthly_lago
ADD CONSTRAINT sales_monthly_lago_pkey
PRIMARY KEY (visma_customer_no, aar, maaned, produktnr, salgstype, fakturadato);
