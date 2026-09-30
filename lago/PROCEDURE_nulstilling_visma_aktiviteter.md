# Procedure — nulstilling af VISMA-aktivitetshistorik

**Domain-brief 24 · reviderad 15. sep 2026.**

Bruges én gang for at markere skillelinjen mellem "VISMA er kilden til
besøgshistorik" og "CRM'et er". Efter denne procedure registrerer
CRM'et alle nye aktiviteter — VISMA leverer ikke længere nye rækker til
`customer_activities_lago`.

## Forudsætning som ikke er teknisk

Det virker først, hvis VISMA-flowet også ændres på den anden side. Sker
en registrering stadig i VISMA (fx kontoret der noterer et besøg
torsdag), når det aldrig CRM'et — og sælgerens historik skrider stille.
Det er en **procesændring i salgsorganisationen**, ikke en systemændring.
CRM'et kan ikke sikre denne del.

## Rækkefølge

Brug tabellen som en tjekliste. Hop ikke et skridt over.

| # | Skridt | Kommando / handling | Godkend før næste |
| ---: | --- | --- | --- |
| 0 | Verificér den nye `aktiviteter.xlsx` | Jonas leverer filen. Rapportér: **antal rækker + ældste + nyeste dato** i den nye eksport. | Ældste dato skal være ≤ 2023-06-02 (matcher eksisterende historik). Hvis nyere: STOP. Bed VISMA om at udvide eksporten. En kortere eksport = tab af 3 års historik. |
| 1 | Tag en kopi af de nuværende `visma_import`-rækker til en fil | Se "Backup-kommando" nedenfor. Fil gemmes lokalt, ikke i basen. | Filen skal eksistere og indeholde alle rækker (≥ det tal du fandt sidst). Uden den er DELETE + import uigenkaldelig. |
| 2 | Slet gamle `visma_import`-rækker | `DELETE FROM customer_activities_lago WHERE source = 'visma_import';` | Kun de rækker skal væk. `crm_native` skal blive stående. |
| 3 | Importér den friske `aktiviteter.xlsx` | `node scripts/lago/import-visma-activities.mjs <path> confirm=YES` | Scriptet upserter på `visma_activity_key`, genberegner `last_visit_at` / `next_visit_planned` merget med CRM-native værdier, og kalder `derive_sales_id_from_visma()` som sidste skridt. |
| 4 | Skriv skæringsdato i loggen | `INSERT INTO sync_runs_lago (datasaet, raekker, er_testdata, note) VALUES ('visma_import', <rækker>, false, 'skæring: VISMA leverer ikke længere aktiviteter — CRM overtager');` | Kør KUN når skridt 3 er lykkedes. Mislykkes importen, må der ikke stå en skæringsdato for noget, der ikke skete. |

## Hvorfor DELETE overhovedet?

Importen er en upsert på en stabil nøgle (`visma_activity_key` =
SHA-256 af `${aftalenr}|${aktoernr}|${dato}|${type_code}|${beskrivelse}|${ansvarlig}`).
Uændrede rækker bliver bare opdateret. Nye rækker tilføjes. Alt det
sker af sig selv.

**DELETE er nødvendig ét sted:** for at fjerne aktiviteter, der er
**slettet i VISMA siden sidst**. Uden DELETE bliver en fejlagtigt
oprettet aktivitet i VISMA-historikken hængende i CRM'et for evigt.

Ergo: DELETE + import er **ikke rutine**. Det er en engangs-oprydning
af historikken. Fremtidige importer (efter skæringsdatoen) skal
normalt IKKE DELETE — de skal bare upserte.

## Backup-kommando (skridt 1)

Kør fra en maskine der har `psql` og et gyldigt `SUPABASE_DB_PASSWORD`:

```bash
DBPW="$(security find-generic-password -s SUPABASE_DB_PASSWORD -w)"
STAMP="$(date +%Y-%m-%d)"
psql "postgresql://postgres.jayufvgsgiuuzpaptjlh:${DBPW}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -c "\\copy (SELECT * FROM public.customer_activities_lago WHERE source = 'visma_import' ORDER BY id) TO 'backup_customer_activities_lago_${STAMP}.csv' WITH CSV HEADER"
```

Verificér filen: `wc -l backup_customer_activities_lago_*.csv` skal vise
antal rækker + 1 (header). Filen bør gemmes et sikkert sted i mindst
90 dage.

## Ejerskabs-afledning — ét sted i koden

`derive_sales_id_from_visma()` er single source of truth for hvordan
`companies.sales_id` afledes fra `visma_sales_code`. **Ingen import
har sin egen kopi.** Både kundeimporten (`import-visma-customers.mjs`)
og aktivitetsimporten (`import-visma-activities.mjs`) kalder funktionen
som sidste skridt.

**To bevidste undtagelser:**

1. Kunder uden `visma_sales_code` (Jonas' håndoprettede) røres ikke —
   deres manuelle ejerskab bevares.
2. Systemkoderne 98 (Webshop), 99 (System) og 999 (ingen sælger)
   får `crm_sales_id = NULL` i mappingen. Kunder med de koder får
   `companies.sales_id = NULL`, som er tilsigtet.

Mappingtabellen `sales_code_map_lago` redigeres i Indstillinger.
Nye VISMA-koder tilføjes der, ikke i migrationer.
