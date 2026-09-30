// Shared helper: læs en fornuftig fejltekst ud af en unknown-fejl.
//
// Baggrund: Supabase's PostgrestError ligner en Error, men er teknisk
// et almindeligt objekt — den er IKKE instanceof Error. Konsekvens af
// den udbredte `err instanceof Error ? err.message : String(err)`-form:
// alle DB-fejl (fx guard-triggeren "Skrivning er ikke tilladt under
// Log ind som…") faldt til String(err) og blev til "[object Object]".
// Værre end en SQL-fejl — den fortæller da trods alt noget.
//
// Denne helper tjekker først instanceof Error, dernæst .message på
// objekter (dækker PostgrestError, FunctionsHttpError-body'er osv.),
// og falder først til String(err) hvis intet af det gav en streng.

export function readErrorMessage(err: unknown): string {
  // Brief 71 §1 (21. sep 2026): PostgrestError sluger sig selv. Én
  // PGRST201 om ambiguous embed ligner præcis en tom liste — fladen
  // viser "ingen data", ingen råber. Fejlen har bidt fire gange (tasks
  // → sales, impersonation_log_lago → sales, customer_activities_lago
  // → companies_lago, kunde_aendringsforslag_lago → sales — sidste
  // stod tavs i to døgn). Løsningen er ikke logging: den er at kode
  // + tabel + indlejring KOMMER PAA SKAERMEN (brief 63) sammen med
  // .message. Så pakker vi Postgrest-signaturen ud her, hvor alle
  // dialoger, widgets, overlays og toaster allerede læser fejlen.
  if (err && typeof err === "object" && !(err instanceof Error)) {
    const e = err as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const code = typeof e.code === "string" ? e.code : null;
    const message = typeof e.message === "string" ? e.message : null;
    const details = typeof e.details === "string" ? e.details : null;
    const hint = typeof e.hint === "string" ? e.hint : null;
    // Kun hvis vi genkender PostgREST-signaturen (PGRST-prefix ELLER
    // Postgres SQLSTATE-lignende kode + message). Ellers falder vi
    // igennem til den generiske .message-læsning nedenunder.
    if (code && message && (code.startsWith("PGRST") || code.length === 5)) {
      const parts = [`${code} · ${message}`];
      if (details) parts.push(details);
      if (hint) parts.push(`Hint: ${hint}`);
      return parts.join(" · ");
    }
  }
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

// Brief 42-korrektur (16. sep 2026): supabase-js pakker en non-2xx
// Edge Function-respons som FunctionsHttpError med et Response-objekt
// på `error.context`. `error.message` er så "Edge Function returned
// a non-2xx status code" — transportlagets besked, ikke den faktiske
// fejl. Denne helper læser body'en og henter { error } eller { message }
// derfra. Async fordi Response.json/.text er async.
//
// Bruges af invitation-, AI- og impersonation-stierne. Falder tilbage
// til readErrorMessage(err) hvis der ikke er nogen context — så også
// PostgrestError-lignende objekter håndteres pænt.
export async function readEdgeFunctionError(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.clone === "function" && typeof ctx.status === "number") {
    try {
      const body = await ctx.clone().json();
      if (body && typeof body === "object") {
        const message =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : typeof (body as { message?: unknown }).message === "string"
              ? (body as { message: string }).message
              : null;
        if (message) return `${message} (HTTP ${ctx.status})`;
      }
    } catch {
      // Body er ikke JSON — prøv rå tekst.
    }
    try {
      const text = await ctx.clone().text();
      if (text) return `${text} (HTTP ${ctx.status})`;
    } catch {
      // Falder igennem til default.
    }
    return `Edge Function svarede med HTTP ${ctx.status}`;
  }
  return readErrorMessage(err);
}
