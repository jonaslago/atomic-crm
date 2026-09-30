import { Check, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";
import type { Forslag } from "./useForslagFraNote";

/**
 * Brief 21 · Et enkelt AI-forslag. To tilstande:
 *
 *  - "usaet" — visning fra modellen med Tilfoej + Afvis. Alt der kommer
 *    fra modellen skal vaere synligt maerket som forslag, indtil det er
 *    tilfoejet (brief §5).
 *
 *  - "tilfoejet" — nu redigerbart: tekst og dato kan aendres. Bliver
 *    gemt naar saelgeren trykker "Gem besoeg".
 *
 * grundlag-linjen er ikke pynt. Den viser hvorfor modellen forslog det,
 * saa saelgeren stoler paa vaerktoejet i stedet for at gaette hvad den
 * havde laest (brief §4).
 */

export interface AktivtForslag {
  type: Forslag["type"];
  tekst: string;
  dato: string | null;
  grundlag: string;
  // Tillæg 21A: den oprindelige AI-tekst/dato gemmes ved siden af den
  // gemte, og edited beregnes ved sammenligning. En AI, hvis forslag
  // altid accepteres men altid omskrives, foreslår det rigtige emne
  // og den forkerte formulering — det er en promptrettelse, ikke en
  // nedlæggelse, men den forskel kan vi ikke se uden begge tekster.
  original_tekst: string;
  original_dato: string | null;
  edited: boolean;
}

interface Props {
  forslag: Forslag;
  status: "usaet" | "tilfoejet";
  onTilfoej: (aktiv: AktivtForslag) => void;
  onAfvis: () => void;
  onOpdater?: (aktiv: AktivtForslag) => void;
}

const TYPE_LABEL: Record<Forslag["type"], string> = {
  opgave: "Opgave",
  opfoelgning: "Opfølgning",
};

// Datoen betyder to lidt forskellige ting afhaengigt af type:
//  - opgave       → deadline (skal vaere gjort inden denne dag)
//  - opfoelgning  → dagen hvor man skal kontakte kunden
// Jonas' feedback: naar noget bliver tilfoejet skal det vaere
// tydeligt at datoen er den faktiske deadline/opfoelgningsdag, ikke
// bare et generisk "dato"-felt.
const DATE_LABEL: Record<Forslag["type"], string> = {
  opgave: "Deadline",
  opfoelgning: "Følg op senest",
};

const DATE_HINT: Record<Forslag["type"], string> = {
  opgave: "Opgaven vises som forfalden efter denne dag.",
  opfoelgning: "Du får en opfølgning på Dagens denne dag.",
};

export function ForslagKort({
  forslag,
  status,
  onTilfoej,
  onAfvis,
  onOpdater,
}: Props) {
  const [tekst, setTekst] = useState(forslag.tekst);
  const [dato, setDato] = useState(forslag.dato ?? "");

  // Tillæg 21A: en enkelt kilde til "er dette rørt siden AI'en gav
  // det?". Sammenlign trimmet tekst og dato-værdi. Skal bruges både
  // ved onOpdater og ved onTilfoej, så helper her holder logikken
  // ét sted.
  const buildAktiv = (næsteTekst: string, næsteDato: string): AktivtForslag => {
    const finalTekst = næsteTekst.trim() || forslag.tekst;
    const finalDato = næsteDato || null;
    const edited =
      finalTekst !== forslag.tekst || finalDato !== (forslag.dato ?? null);
    return {
      type: forslag.type,
      tekst: finalTekst,
      dato: finalDato,
      grundlag: forslag.grundlag,
      original_tekst: forslag.tekst,
      original_dato: forslag.dato ?? null,
      edited,
    };
  };

  const opdater = (næsteTekst: string, næsteDato: string) => {
    setTekst(næsteTekst);
    setDato(næsteDato);
    onOpdater?.(buildAktiv(næsteTekst, næsteDato));
  };

  const tilfoej = () => {
    onTilfoej(buildAktiv(tekst, dato));
  };

  const erTilfoejet = status === "tilfoejet";

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        erTilfoejet
          ? "border-[var(--a)] bg-[var(--a-tint)]"
          : "border-dashed border-[var(--line-strong)]",
      )}
    >
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-[var(--a-deep)] text-[var(--a-deep)] text-xs font-bold uppercase tracking-wide"
        >
          {erTilfoejet ? TYPE_LABEL[forslag.type] : (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Sparkles} size="sm" />
              Forslag · {TYPE_LABEL[forslag.type]}
            </span>
          )}
        </Badge>
      </div>

      {erTilfoejet ? (
        <div className="mt-2 space-y-3">
          <div className="space-y-1">
            <Label
              htmlFor={`forslag-tekst-${forslag.grundlag.slice(0, 8)}`}
              className="text-muted-foreground text-xs font-bold uppercase tracking-wide"
            >
              {TYPE_LABEL[forslag.type]}
            </Label>
            <Input
              id={`forslag-tekst-${forslag.grundlag.slice(0, 8)}`}
              value={tekst}
              onChange={(e) => opdater(e.target.value, dato)}
              maxLength={80}
              className="text-base font-bold"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor={`forslag-dato-${forslag.grundlag.slice(0, 8)}`}
              className="text-muted-foreground text-xs font-bold uppercase tracking-wide"
            >
              {DATE_LABEL[forslag.type]}
            </Label>
            <Input
              id={`forslag-dato-${forslag.grundlag.slice(0, 8)}`}
              type="date"
              value={dato}
              onChange={(e) => opdater(tekst, e.target.value)}
              className="text-base"
            />
            <p className="text-muted-foreground text-sm">
              {DATE_HINT[forslag.type]}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          <div className="text-base font-bold text-[var(--fg)]">
            {forslag.tekst}
          </div>
          {forslag.dato && (
            <div className="text-muted-foreground text-sm tabular-nums">
              {formatDato(forslag.dato)}
            </div>
          )}
        </div>
      )}

      <div className="text-muted-foreground mt-2 border-t pt-2 text-sm italic">
        "{forslag.grundlag}"
      </div>

      {!erTilfoejet && (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            onClick={tilfoej}
            className="min-h-11 flex-1 gap-1.5 bg-[var(--a-deep)] text-white hover:bg-[var(--a-deep)]/90"
          >
            <Icon icon={Check} size="sm" />
            Tilføj
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onAfvis}
            className="min-h-11 gap-1.5"
          >
            <Icon icon={X} size="sm" />
            Afvis
          </Button>
        </div>
      )}
    </div>
  );
}

const datoFmt = new Intl.DateTimeFormat("da-DK", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function formatDato(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return datoFmt.format(d);
}
