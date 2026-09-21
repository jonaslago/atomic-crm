import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { useGetIdentity } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { Icon } from "@/lago/ui/Icon";

import { DryRunSummary } from "./DryRunSummary";
import { fetchCompanyAktoerLookup, importKontakter } from "./executeImport";
import { parseKontakter } from "./parsers/kontakter";
import type { DryRunResult, KontakterPayload } from "./types";

interface KontakterImportSectionProps {
  isAdmin: boolean;
}

/**
 * Domain-brief 29 · Engangsimport af VISMAs kontaktpersoner.
 *
 * ADSKILT fra Sales-Import-sektionen med vilje: CRM'et er master for
 * kontakter fra 16. sep 2026. Denne fil må IKKE i det natlige flow — så
 * ville sælgerens rettelser blive overskrevet natten efter, og han
 * holder op med at rette anden gang det sker.
 *
 * Kør én gang som fundament. 528 kontakter i dagens fil; 439 matcher
 * en kunde (importeres), 89 er leverandører/medarbejdere (rapporteres,
 * ikke importeret). Match på visma_aktoer_nr — kan køres igen uden at
 * skabe dubletter.
 */
export function KontakterImportSection({
  isAdmin,
}: KontakterImportSectionProps) {
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DryRunResult<KontakterPayload> | null>(
    null,
  );
  const [busy, setBusy] = useState<"idle" | "parsing" | "importing">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Slå aktoer_nr → company_id op på forhånd. Parseren bruger det til
  // at fortælle "N kan bindes, M kan ikke" i tørløbet.
  const aktoerLookup = useQuery({
    queryKey: ["lago-company-aktoer-lookup"],
    queryFn: fetchCompanyAktoerLookup,
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });

  if (!isAdmin) return null;

  const runDryRun = async () => {
    if (!file || !aktoerLookup.data) return;
    setBusy("parsing");
    setFeedback(null);
    try {
      const r = await parseKontakter({
        file,
        companyLookupByAktoerNr: aktoerLookup.data,
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
    setFeedback("Importerer kontakter …");
    try {
      const { n_created, n_updated, n_kunder_touched } = await importKontakter(
        result.payload,
        currentSalesId,
        (msg) => setFeedback(msg),
      );
      setFeedback(
        `Færdig: ${n_created} nye kontakter oprettet, ${n_updated} eksisterende opdateret, ` +
          `${n_kunder_touched} kunder berørt. Kontakter vedligeholdes nu i CRM'et — ` +
          `filen skal ikke køres igen som del af det natlige flow.`,
      );
      setFile(null);
      setResult(null);
    } catch (err) {
      setFeedback(`Fejl: ${(err as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engangsimport: kontaktpersoner fra VISMA</CardTitle>
        <CardDescription>
          <strong>Engangsimport. Kontakter vedligeholdes i CRM'et.</strong>{" "}
          Filen må <strong>ikke</strong> i det natlige flow — CRM'et er master
          for kontakter fra 16. sep 2026. Kør denne en gang som fundament;
          derefter er det sælgerens rettelser der gælder.
          <br />
          <br />
          Filen fra VISMA har rapportnavnet "Aktør" i første række og headeren i
          række 2. Koblingen til kunden går via kolonnen "Kontaktperson for"
          (kundens Aktørnr.). Aktører der ikke er kunder (leverandører,
          medarbejdere) springes over og rapporteres. Kan køres to gange uden
          dubletter (match på Aktørnr. + navn).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {aktoerLookup.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon icon={Loader2} size="sm" className="animate-spin" />
            Henter kunde-Aktørnr.-liste …
          </div>
        ) : aktoerLookup.isError ? (
          <div className="text-[var(--st-red-fg)] text-sm">
            Kunne ikke hente kunde-Aktørnr.-listen. Prøv at genindlæse siden.
          </div>
        ) : (
          <>
            <div>
              <Label className="mb-1 block text-sm font-bold">
                Vælg Kontakter-xlsx-fil
              </Label>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={busy !== "idle"}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult(null);
                  setFeedback(null);
                }}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-[var(--ink)] file:px-4 file:py-2 file:text-white file:font-bold hover:file:bg-[var(--ink)]/90 disabled:opacity-50"
              />
              {file && (
                <div className="text-muted-foreground mt-1 text-xs">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </div>
              )}
            </div>
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
                    "Importér kontakter"
                  )}
                </Button>
              )}
            </div>
            {feedback && (
              <div className="text-sm font-bold text-[var(--fg-2)]">
                {feedback}
              </div>
            )}
            {result && <DryRunSummary result={result} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
