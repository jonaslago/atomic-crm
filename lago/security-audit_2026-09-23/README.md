# Sikkerhedsgennemgang · 23. sep 2026

**Advarsel:** Supabase Advisors flaggede den 19. sep `lago_last_visit_backup_20260919` som
`rls_disabled_in_public` — CRITICAL, "Anyone with your project URL can read, edit, and delete
all data in this table". Set 23. sep (brief 79).

## Blev der læst noget?

**Nej.** Målt via `pg_stat_user_tables` og `pg_stat_statements` (uafhængigt af log-retention):

- **3 seq_scans** siden oprettelsen — alle tre er admin-queries via Management API
  (`CREATE TABLE AS SELECT`, `SELECT count(*)`, diff-check mod `companies_lago`).
- **0 opdateringer, 0 sletninger** (`n_tup_upd=0`, `n_tup_del=0`).
- Ingen queries via anon-nøgle / PostgREST.

Tabellen har været urørt af udenforstående i de fire dage den var eksponeret.

## Hvad var tabellen

Rollback-grundlag for en `last_visit_at`-ændring på `companies_lago` den 19. sep.
1.167 rækker (én pr. kunde), to kolonner: `company_id` (bigint), `last_visit_at` (timestamptz).
Ingen navne/telefonnumre/e-mails, men `company_id` er indirekte identificerende.

27 kunder har fået `last_visit_at` ændret siden 19. sep (diff dokumenteret i
`backup-table-and-rls-audit.json`, felt `diff_backup_vs_current`).

## Hvad ligger her

| Fil | Formål |
| --- | --- |
| `README.md` | Dette svar. Læses uden JSON-parser. |
| `backup-table-and-rls-audit.json` | Beviset: alle queries, statistik, RLS-status for alle tabeller, policies på kerne-tabeller. |
| `lago_last_visit_backup_20260919.csv` | Rollback-data (1.167 rækker) i CSV. Bevaret så tabellen kan droppes uden at miste rollback-muligheden. |
| `lago_last_visit_backup_20260919.json` | Samme rollback-data i JSON. |

## Handling

- Tabellen droppet med migration `20260923140000_lago_79_drop_backup_and_secure_views.sql`.
- Samme migration satte `security_invoker=on` på seks LAGO-views
  (`customers_with_priority_lago`, `lago_activity_log`, `v_open_orders_categorised`,
  `v_sales_customer_periods`, `v_sales_district_periods`, `v_customer_activity_status`).
  No-op i dag fordi alle SELECT-policies bruger `qual=true`, men fjerner fladen for at nye
  RLS-politikker (planlagt fra 29. sep) omgås af viewsene.
- `init_state` urørt (Atomic CRM's egen, sat til `security_invoker=off` med vilje).

## Skulle vi undersøge mere?

Nej. Tabellen var eksponeret men urørt, backup-dataene er bevaret, og fladen er lukket
uden adfærdsændring. Fejlen har efterladt et spor (denne mappe) — den næste midlertidige
tabel, der bliver permanent, kan findes ved at søge efter noget lignende.
