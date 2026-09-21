import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { useGetIdentity } from "ra-core";

import { SYNC_RUNS_KEY } from "@/lago/settings/SyncRunsSection";
import { LatestSyncNote } from "./LatestSyncNote";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { Icon } from "@/lago/ui/Icon";

import { DryRunSummary } from "./DryRunSummary";
import {
  fetchAcceptedProductGroups,
  fetchCrmCustomerLookup,
  importAabneOrdrer,
  importKunder,
  importProdukter,
  importProdukttransaktioner,
  resetTestdata,
} from "./executeImport";
import { parseAabneOrdrer } from "./parsers/aabneOrdrer";
import { parseKunder } from "./parsers/kunder";
import { parseProdukter } from "./parsers/produkter";
import { parseProdukttransaktioner } from "./parsers/produkttransaktioner";
import type {
  AabneOrdrerPayload,
  DryRunResult,
  KunderPayload,
  ProdukterPayload,
  ProdukttransaktionerPayload,
} from "./types";

interface SalesImportSectionProps {
  isAdmin: boolean;
}

type Mode = "testdata" | "driftsdata";

export function SalesImportSection({ isAdmin }: SalesImportSectionProps) {
  const [mode, setMode] = useState<Mode>("testdata");

  const lookup = useQuery({
    queryKey: ["lago-crm-customer-lookup"],
    queryFn: fetchCrmCustomerLookup,
    enabled: isAdmin,
  });

  const productGroups = useQuery({
    queryKey: ["lago-sales-product-groups"],
    queryFn: fetchAcceptedProductGroups,
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import af salgsdata</CardTitle>
        <CardDescription>
          Fra VISMA-eksport til CRM'et. Vælg om filen er testdata eller
          driftsdata — <strong>testdata</strong> er forvalgt så systemet ikke
          ved uheld læser demo-tal som virkelige. Amber-bandet øverst i appen
          forsvinder først når alle testdata er ryddet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ModeToggle mode={mode} onChange={setMode} />

        <Vejledning />

        {lookup.isPending || productGroups.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon icon={Loader2} size="sm" className="animate-spin" />
            Henter CRM-kundeliste og produktgruppe-filter …
          </div>
        ) : lookup.isError || productGroups.isError ? (
          <div className="text-[var(--st-red-fg)] text-sm">
            Kunne ikke hente forudsætninger. Prøv at genindlæse siden.
          </div>
        ) : (
          <>
            {/*
              Brief 25 §5: rækkefølgen ombyttes. Kunder skal først,
              fordi den sætter distrikt som transaktions- og
              ordre-filteret bruger. Produkter skal FØR
              produkttransaktioner (spærring — ellers kan et
              kundekort kun vise varenumre) — det er allerede
              importsidens egen instruks; nu er den også
              rækkefølge-håndhævet.

              Ny sekvens: Kunder → Produkter → Produkttransaktioner
              → Åbne ordrer.
            */}
            <KunderImport mode={mode} crmCustomers={lookup.data.customers} />
            <ProdukterImport mode={mode} />
            <ProdukttransaktionerImport
              mode={mode}
              districtLookup={lookup.data.district}
              acceptedProductGroups={productGroups.data}
            />
            <AabneOrdrerImport
              mode={mode}
              districtLookup={lookup.data.district}
            />
          </>
        )}

        <ResetTestdataAction />
      </CardContent>
    </Card>
  );
}

// -------------------- Mode toggle --------------------

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-bold uppercase tracking-wide">
        Datatype for de næste importer
      </Label>
      <RadioGroup
        value={mode}
        onValueChange={(v) => onChange(v as Mode)}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="testdata" id="mode-test" />
          <Label htmlFor="mode-test" className="cursor-pointer">
            Testdata (forvalgt)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="driftsdata" id="mode-drift" />
          <Label htmlFor="mode-drift" className="cursor-pointer">
            Driftsdata
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

// -------------------- Vejledning --------------------

function Vejledning() {
  return (
    <details className="rounded border bg-[var(--surface-2)] p-3 text-sm">
      <summary className="cursor-pointer font-bold">
        Vejledning til de fire OSR-udtræk (brief 25)
      </summary>
      <ul className="mt-3 ml-6 list-disc space-y-1.5">
        <li>
          <strong>1. Kunder</strong> — hele kundetabellen. Sætter distrikt
          (Øst/Vest/HQ), kundetype, aktiv-flag og sælgerkode. Sælger-koden
          drives af <code>derive_sales_id_from_visma()</code>
          som sidste skridt. Kunder der ikke er i CRM'et, vises som ukendte og
          opdateres ikke.
        </li>
        <li>
          <strong>2. Produkter</strong> — hele produkttabellen. Uden dem kan et
          kundekort kun vise varenumre. Skal ind FØR produkttransaktioner og
          åbne ordrer, ellers kan navnene ikke slås op.
        </li>
        <li>
          <strong>3. Produkttransaktioner</strong> — filtreret på{" "}
          <code>Distrikt IN (10 Øst, 11 Vest, 12 HQ)</code> (via kunde-opslag)
          og produktgrupper fra <code>lago_settings.sales_product_groups</code>.
          <strong> Fakturadato</strong> bestemmer måneden.
        </li>
        <li>
          <strong>4. Åbne ordrer</strong> — <em>én fil</em> med både hoveder og
          linjer (OSR leverer det samlet, ikke to filer som 19b). Kategorien
          (fejl / ikke_kundeordre / reservation / en_primeur / restordre / mav /
          uden_dato / med_dato) udledes i view. Linjer med{" "}
          <code>Undtages lagerhåndtering = 1</code> (pant/fragt/gebyrer)
          filtreres væk før alt andet. Linjer med Ordrestatus 11/12/19/20
          afvises som indkøbsordrer.
        </li>
        <li>
          Importen fejler <em>højlydt</em> ved manglende kolonner og viser
          hvilke der er i filen. OSR- og 19b-navne accepteres begge — én af
          aliaserne skal findes pr. required-kolonne.
        </li>
      </ul>
    </details>
  );
}

// -------------------- Sub-sektion base --------------------

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h4 className="text-base font-bold">{title}</h4>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FileInput({
  label,
  onFile,
  file,
  disabled,
}: {
  label: string;
  onFile: (f: File | null) => void;
  file: File | null;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="mb-1 block text-sm font-bold">{label}</Label>
      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-[var(--ink)] file:px-4 file:py-2 file:text-white file:font-bold hover:file:bg-[var(--ink)]/90 disabled:opacity-50"
      />
      {file && (
        <div className="text-muted-foreground mt-1 text-xs">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </div>
      )}
    </div>
  );
}

// -------------------- Produkter (stamdata) --------------------

function ProdukterImport({ mode }: { mode: Mode }) {
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DryRunResult<ProdukterPayload> | null>(
    null,
  );
  const [busy, setBusy] = useState<"idle" | "parsing" | "importing">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const qc = useQueryClient();

  const runDryRun = async () => {
    if (!file) return;
    setBusy("parsing");
    setFeedback(null);
    try {
      const r = await parseProdukter({ file });
      setResult(r);
    } catch (err) {
      setFeedback(`Fejl ved parsing: ${(err as Error).message}`);
      setResult(null);
    } finally {
      setBusy("idle");
    }
  };

  const runImport = async () => {
    if (!result?.payload) return;
    setBusy("importing");
    setFeedback("Slår eksisterende varer op …");
    try {
      const { rowsWritten, retained_status7, currentTotalInTable } =
        await importProdukter(
          result.payload,
          mode === "testdata",
          currentSalesId,
          (p) => {
            if (p.phase === "lookup") {
              setFeedback(
                `Slår eksisterende varer op … ${p.currentChunk}/${p.totalChunks} chunks`,
              );
            } else if (p.phase === "upsert") {
              setFeedback(
                `Skriver til products_lago … chunk ${p.currentChunk}/${p.totalChunks} (${p.rowsWrittenSoFar} af ${result.payload!.length} rækker)`,
              );
            }
          },
        );
      const base = `Importeret: ${rowsWritten} varer skrevet. products_lago indeholder nu ${currentTotalInTable} varer i alt.`;
      setFeedback(
        retained_status7 > 0
          ? `${base} ${retained_status7} eksisterende udgåede (status=7) bevaret (tillæg A: udgået vinder).`
          : base,
      );
      setFile(null);
      setResult(null);
      qc.invalidateQueries({ queryKey: SYNC_RUNS_KEY });
    } catch (err) {
      // Fejlbeskeden fra executeImport er allerede meningsfuld — den
      // siger hvor mange rækker der nåede igennem, hvor mange der står
      // i basen nu, og at det er sikkert at prøve igen (upsert er
      // idempotent).
      setFeedback(`Fejl: ${(err as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  return (
    <SectionShell
      title="1. Produkter (stamdata — aktive + udgåede)"
      description="OSR leverer to filer: Produkter (~2.500 aktive) og Produkter – udgået (~5.070 status=7). Kør begge, i vilkårlig rækkefølge — importen er en upsert på produktnr, og eksisterende status=7 bevares hvis en aktiv fil siger noget andet (tillæg A). Uden begge filer mangler produktnavne på 30 % af fakturalinjerne."
    >
      <div className="space-y-3">
        <FileInput
          label="Vælg xlsx-fil (Produkter eller Produkter – udgået)"
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
            setFeedback(null);
          }}
          disabled={busy !== "idle"}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runDryRun}
            disabled={!file || busy !== "idle"}
            variant="outline"
          >
            {busy === "parsing" ? (
              <>
                <Icon icon={Loader2} size="sm" className="animate-spin" />
                Kører tørløb …
              </>
            ) : (
              <>
                <Icon icon={Upload} size="sm" />
                Kør tørløb
              </>
            )}
          </Button>
          {result?.ok && (
            <Button onClick={runImport} disabled={busy !== "idle"}>
              {busy === "importing" ? (
                <>
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  Importerer …
                </>
              ) : (
                `Importér som ${mode === "testdata" ? "testdata" : "driftsdata"}`
              )}
            </Button>
          )}
        </div>
        {feedback && (
          <>
            <div className="text-sm font-bold text-[var(--fg-2)]">
              {feedback}
            </div>
            <LatestSyncNote datasaet="products" />
          </>
        )}
        {result && <DryRunSummary result={result} />}
      </div>
    </SectionShell>
  );
}

// -------------------- Produkttransaktioner --------------------

function ProdukttransaktionerImport({
  mode,
  districtLookup,
  acceptedProductGroups,
}: {
  mode: Mode;
  districtLookup: Map<string, string | null>;
  acceptedProductGroups: Set<string>;
}) {
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] =
    useState<DryRunResult<ProdukttransaktionerPayload> | null>(null);
  const [busy, setBusy] = useState<"idle" | "parsing" | "importing">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const qc = useQueryClient();

  const runDryRun = async () => {
    if (!file) return;
    setBusy("parsing");
    setFeedback(null);
    try {
      const r = await parseProdukttransaktioner({
        file,
        districtLookup: districtLookup as unknown as {
          get: (k: string) => string | null | undefined;
          has: (k: string) => boolean;
        },
        acceptedProductGroups,
      });
      setResult(r);
    } catch (err) {
      setFeedback(`Fejl ved parsing: ${(err as Error).message}`);
      setResult(null);
    } finally {
      setBusy("idle");
    }
  };

  const runImport = async () => {
    if (!result?.payload) return;
    setBusy("importing");
    setFeedback(null);
    try {
      const { rowsWritten } = await importProdukttransaktioner(
        result.payload,
        mode === "testdata",
        currentSalesId,
      );
      setFeedback(
        `Importeret: ${rowsWritten} rækker som ${mode === "testdata" ? "testdata" : "driftsdata"}.`,
      );
      setFile(null);
      setResult(null);
      qc.invalidateQueries({ queryKey: SYNC_RUNS_KEY });
    } catch (err) {
      setFeedback(`Fejl ved import: ${(err as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  return (
    <SectionShell
      title="2. Produkttransaktioner"
      description="Faktureret omsætning fra VISMAs Produkttransaktioner. Aggregeres til én række pr. kunde × år × måned × produktnr × salgstype. Filter: distrikt Øst/Vest/HQ + produktgruppe fra settings."
    >
      <div className="space-y-3">
        <FileInput
          label="Vælg xlsx-fil"
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
            setFeedback(null);
          }}
          disabled={busy !== "idle"}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runDryRun}
            disabled={!file || busy !== "idle"}
            variant="outline"
          >
            {busy === "parsing" ? (
              <>
                <Icon icon={Loader2} size="sm" className="animate-spin" />
                Kører tørløb …
              </>
            ) : (
              <>
                <Icon icon={Upload} size="sm" />
                Kør tørløb
              </>
            )}
          </Button>
          {result?.ok && (
            <Button onClick={runImport} disabled={busy !== "idle"}>
              {busy === "importing" ? (
                <>
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  Importerer …
                </>
              ) : (
                `Importér som ${mode === "testdata" ? "testdata" : "driftsdata"}`
              )}
            </Button>
          )}
        </div>
        {feedback && (
          <>
            <div className="text-sm font-bold text-[var(--fg-2)]">
              {feedback}
            </div>
            <LatestSyncNote datasaet="sales_monthly" />
          </>
        )}
        {result && <DryRunSummary result={result} />}
      </div>
    </SectionShell>
  );
}

// -------------------- Kunder --------------------

function KunderImport({
  mode,
  crmCustomers,
}: {
  mode: Mode;
  crmCustomers: Set<string>;
}) {
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DryRunResult<KunderPayload> | null>(
    null,
  );
  const [busy, setBusy] = useState<"idle" | "parsing" | "importing">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const qc = useQueryClient();

  const runDryRun = async () => {
    if (!file) return;
    setBusy("parsing");
    setFeedback(null);
    try {
      const r = await parseKunder({ file, crmCustomers });
      setResult(r);
    } catch (err) {
      setFeedback(`Fejl ved parsing: ${(err as Error).message}`);
      setResult(null);
    } finally {
      setBusy("idle");
    }
  };

  const runImport = async () => {
    if (!result?.payload) return;
    setBusy("importing");
    setFeedback(null);
    try {
      const { rowsWritten } = await importKunder(
        result.payload,
        mode === "testdata",
        currentSalesId,
      );
      setFeedback(`Opdateret: ${rowsWritten} kunder i companies_lago.`);
      setFile(null);
      setResult(null);
      // Brief 62 §1: sync-noten er lige blevet skrevet. Invalidér så
      // LatestSyncNote og SyncRunsSection henter den nye med det samme.
      qc.invalidateQueries({ queryKey: SYNC_RUNS_KEY });
    } catch (err) {
      setFeedback(`Fejl ved import: ${(err as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  return (
    <SectionShell
      title="3. Kunder (masterdata)"
      description="Opdaterer distrikt, kundetype (prisliste) og aktiv-flag på eksisterende kunder. Rører ikke kunder der ikke er i CRM'et."
    >
      <div className="space-y-3">
        <FileInput
          label="Vælg xlsx-fil"
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
            setFeedback(null);
          }}
          disabled={busy !== "idle"}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runDryRun}
            disabled={!file || busy !== "idle"}
            variant="outline"
          >
            {busy === "parsing" ? (
              <>
                <Icon icon={Loader2} size="sm" className="animate-spin" />
                Kører tørløb …
              </>
            ) : (
              <>
                <Icon icon={Upload} size="sm" />
                Kør tørløb
              </>
            )}
          </Button>
          {result?.ok && (
            <Button onClick={runImport} disabled={busy !== "idle"}>
              {busy === "importing" ? (
                <>
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  Opdaterer …
                </>
              ) : (
                "Opdatér kunder"
              )}
            </Button>
          )}
        </div>
        {feedback && (
          <>
            <div className="text-sm font-bold text-[var(--fg-2)]">
              {feedback}
            </div>
            {/* Brief 62 §1 (18. sep 2026): hele sync-noten ordret under
                kvitteringen. En log der findes men ikke kan ses er en
                log ingen bruger. */}
            <LatestSyncNote datasaet="customers" />
          </>
        )}
        {result && <DryRunSummary result={result} />}
      </div>
    </SectionShell>
  );
}

// -------------------- Åbne ordrer (1 fil — brief 25) --------------------

function AabneOrdrerImport({
  mode,
  districtLookup,
}: {
  mode: Mode;
  districtLookup: Map<string, string | null>;
}) {
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DryRunResult<AabneOrdrerPayload> | null>(
    null,
  );
  const [busy, setBusy] = useState<"idle" | "parsing" | "importing">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const qc = useQueryClient();

  const runDryRun = async () => {
    if (!file) return;
    setBusy("parsing");
    setFeedback(null);
    try {
      const r = await parseAabneOrdrer({
        file,
        districtLookup: districtLookup as unknown as {
          get: (k: string) => string | null | undefined;
          has: (k: string) => boolean;
        },
      });
      setResult(r);
    } catch (err) {
      setFeedback(`Fejl ved parsing: ${(err as Error).message}`);
      setResult(null);
    } finally {
      setBusy("idle");
    }
  };

  const runImport = async () => {
    if (!result?.payload) return;
    setBusy("importing");
    setFeedback(null);
    try {
      const { rowsWritten } = await importAabneOrdrer(
        result.payload,
        mode === "testdata",
        currentSalesId,
      );
      setFeedback(
        `Importeret: ${rowsWritten} ordrelinjer (hele tabellen erstattet).`,
      );
      setFile(null);
      setResult(null);
      qc.invalidateQueries({ queryKey: SYNC_RUNS_KEY });
    } catch (err) {
      setFeedback(`Fejl ved import: ${(err as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  return (
    <SectionShell
      title="4. Åbne ordrer (én fil — hoveder + linjer samlet)"
      description="OSR leverer ordrer og linjer i én fil. Kategorien (fejl / ikke_kundeordre / reservation / en_primeur / restordre / mav / uden_dato / med_dato) udledes i view. Linjer med Undtages lagerhåndtering = 1 filtreres væk. Ordrestatus 11/12/19/20 (indkøbsordrer) afvises med fejl. Hele tabellen erstattes ved import."
    >
      <div className="space-y-3">
        <FileInput
          label="Vælg xlsx-fil (åbne ordrer, OSR-format)"
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
            setFeedback(null);
          }}
          disabled={busy !== "idle"}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runDryRun}
            disabled={!file || busy !== "idle"}
            variant="outline"
          >
            {busy === "parsing" ? (
              <>
                <Icon icon={Loader2} size="sm" className="animate-spin" />
                Kører tørløb …
              </>
            ) : (
              <>
                <Icon icon={Upload} size="sm" />
                Kør tørløb
              </>
            )}
          </Button>
          {result?.ok && (
            <Button onClick={runImport} disabled={busy !== "idle"}>
              {busy === "importing" ? (
                <>
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  Importerer …
                </>
              ) : (
                `Erstat åbne ordrer som ${mode === "testdata" ? "testdata" : "driftsdata"}`
              )}
            </Button>
          )}
        </div>
        {feedback && (
          <>
            <div className="text-sm font-bold text-[var(--fg-2)]">
              {feedback}
            </div>
            <LatestSyncNote datasaet="open_orders" />
          </>
        )}
        {result && <DryRunSummary result={result} />}
      </div>
    </SectionShell>
  );
}

// -------------------- Reset testdata --------------------

function ResetTestdataAction() {
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const { deleted } = await resetTestdata(currentSalesId);
      setFeedback(
        `Slettet: ${deleted} testdata-rækker. Amber-bånd forsvinder ved næste sideindlæsning.`,
      );
      setConfirmOpen(false);
    } catch (err) {
      setFeedback(`Fejl: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--st-amber-fg)]/30 bg-[var(--st-amber-bg)]/40 p-4">
      <h4 className="text-base font-bold text-[var(--st-amber-fg)]">
        Ryd alle testdata
      </h4>
      <p className="text-muted-foreground mt-1 text-sm">
        Sletter alle rækker med <code>er_testdata = true</code> fra
        sales_monthly_lago og open_orders_lago. Driftsdata rører vi ikke.
        Kørslen logges i sync_runs_lago.
      </p>
      {!confirmOpen ? (
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          Ryd alle testdata …
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-bold">
            Bekræft: Slet ALLE testdata-rækker permanent?
          </p>
          <div className="flex gap-2">
            <Button onClick={run} disabled={busy}>
              {busy ? (
                <>
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  Sletter …
                </>
              ) : (
                "Ja, slet testdata"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Fortryd
            </Button>
          </div>
        </div>
      )}
      {feedback && (
        <div className="mt-2 text-sm font-bold text-[var(--fg-2)]">
          {feedback}
        </div>
      )}
    </div>
  );
}
