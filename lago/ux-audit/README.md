# Designsystem-audit

Går alle skærme igennem i tre størrelser og rapporterer, hvor fladen bryder med
`design/LAGO_Design_System_implementering.md`.

Formålet er ikke at erstatte et menneskes øje. Det er at gøre den **målbare** del af en
UX-gennemgang til noget, der kan køres igen efter hver deploy — så designsystemet ikke skrider
stille, sådan som det gjorde mellem udrulningen og felt-testen.

## Sådan køres den

```bash
node lago/ux-audit/login.mjs     # én gang — du logger ind i vinduet der åbner
node lago/ux-audit/audit.mjs     # mod crm.lago.dk
```

Mod et lokalt miljø: `node lago/ux-audit/audit.mjs http://localhost:5173`

Rapporten lander i `lago/ux-audit/rapport.md`. Scriptet afslutter med kode 1, hvis der er
kritiske fund — så det senere kan bruges som port i en byggeproces.

**Adgangskoder gemmes ingen steder.** `login.mjs` åbner et rigtigt vindue, du logger ind selv, og
kun sessionen gemmes i `.session.json`, som er git-ignoreret. Udløber sessionen, køres `login.mjs`
igen.

## Hvad den tjekker

| Regel | Krav |
| --- | --- |
| Berøringsmål | 44 × 44 px · afkrydsning 24 px boks |
| Skriftstørrelse | mindst 12 px |
| Vægt 600 | findes ikke i Helvetica Neue — skal være 700 |
| Kursiv | findes ikke i systemet |
| Skrifttype | Helvetica Neue / Helvetica / Arial |
| Kontrast | mindst 4,5:1 mod effektiv baggrund |
| Ikonstørrelse | mindst 20 px |
| Grønne knapper | grøn betyder "ajour", ikke "tryk her" |
| Hårdkodede farver | farver skal komme fra tokens |
| Unicode som ikon | `→ ← × ✎ ☎ ◈ ▤ ⌕ ☰` skal være `<Icon>` |
| Vandret overløb | siden må ikke være bredere end vinduet |
| Tekst der klippes | rapporteres, så det kan vurderes |
| Ikon-knap uden navn | skal have `aria-label` |

## Hvad den IKKE kan

Den måler pixels. Den kan ikke afgøre, om skærmen giver mening.

Den ser ikke: om en sælger kan gennemføre sin opgave · om informationshierarkiet er rigtigt · om
en tommelfinger kan nå knappen på en stor telefon · om iOS-tastaturet dækker feltet · om scroll
hakker på kortet · om noget er læsbart i sol.

Det finder man ved at bruge systemet. Auditten frigør bare tiden til det.

## Når en regel ændres

Reglerne står i `rules.mjs` og er en kopi af specifikationen. Ændres et krav i
`design/LAGO_Design_System_implementering.md`, skal `rules.mjs` rettes samtidig — ellers begynder
auditten at måle mod noget, der ikke længere er sandt.

## Accepterede undtagelser

`EXCEPTIONS`-arrayet øverst i `rules.mjs` samler fund vi bevidst har accepteret. Hver undtagelse
har en klartekst-begrundelse. Uden listen ville rapporten vokse med accepterede fund ved hver
kørsel, og folk ville holde op med at læse den.

Tilføj en undtagelse ved at skrive én ny post — regel + CSS-selector + hvorfor. Fjern den så snart
beslutningen ændres. En undtagelse uden begrundelse er teknisk gæld i forklædning.
