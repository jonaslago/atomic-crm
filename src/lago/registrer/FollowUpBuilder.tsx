import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";

import type { AssignableUser } from "./useAssignableUsers";

/**
 * Brief 40 tillæg A · Manuel opfølgning uden AI.
 *
 * Under notefeltet på Besøg og Aktivitet: én knap der folder tre felter
 * ud (hvad, hvornår, hvem). Ingen ny dialog, intet fanebladsskift.
 * Gemmes sammen med registreringen — samme kontaktbinding som AI-
 * flowet, samme kode-sti, bare uden `ai_llm_call_id` på task-rækken.
 *
 * Datamodel-markøren: en tomt `ai_llm_call_id` = manuel oprindelse.
 * Brief 21 tillæg A's måling filtrerer `ai_llm_call_id IS NOT NULL`
 * for at tælle AI-forslag; alle andre nye tasks under felttest er
 * dermed manuelle. Ingen ny kolonne behøves — de to indgange har
 * hver sit spor allerede.
 */

export interface ManualFollowUp {
  /** UID til React-lister. Ikke persisteret. */
  key: string;
  text: string;
  /** YYYY-MM-DD eller null (ingen forfald). */
  dueDateIso: string | null;
  /** null = Backoffice-kø (sales_id NULL på tasks-rækken). */
  assigneeSalesId: number | null;
}

interface Props {
  items: ManualFollowUp[];
  onItemsChange: (items: ManualFollowUp[]) => void;
  assignableUsers: AssignableUser[];
  /** Brief 84 §4 (28. sep 2026): standard-modtager af en ny opfølgning.
   *  Under dækning: kundens ansvarlige sælger (viewSalesId=Camilla).
   *  Ellers: brugeren selv. Kan altid overskrives i "Hvem?"-vælgeren.
   *  Navnet siger "default" så næste læser ikke tror det er "min egen". */
  defaultAssigneeSalesId: number | null;
}

// Brief-krav: forfald med genveje så sælgeren ikke skriver datoer i en
// bil. "om 14 dage" er et almindeligt B/C-interval; "om en uge" et
// almindeligt A. Fri dato som fallback for det, ingen genvej dækker.
const DATE_SHORTCUTS: Array<{ id: string; label: string; days: number }> = [
  { id: "tomorrow", label: "I morgen", days: 1 },
  { id: "week", label: "Om en uge", days: 7 },
  { id: "fortnight", label: "Om 14 dage", days: 14 },
];

const CUSTOM_DATE = "__custom__";
const NO_DATE = "__none__";

function isoAddDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function matchShortcut(dateIso: string | null): string {
  if (!dateIso) return NO_DATE;
  for (const s of DATE_SHORTCUTS) {
    if (isoAddDays(s.days) === dateIso) return s.id;
  }
  return CUSTOM_DATE;
}

function makeKey(): string {
  return `fu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FollowUpBuilder({
  items,
  onItemsChange,
  assignableUsers,
  defaultAssigneeSalesId,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ManualFollowUp>(() =>
    makeDraft(defaultAssigneeSalesId),
  );

  function makeDraft(sid: number | null): ManualFollowUp {
    return {
      key: makeKey(),
      text: "",
      dueDateIso: isoAddDays(7),
      assigneeSalesId: sid,
    };
  }

  const commitDraft = () => {
    const trimmed = draft.text.trim();
    // Brief-krav: tomt felt → ingen opgave, ingen advarsel. Bare skjul.
    if (!trimmed) {
      setAdding(false);
      setDraft(makeDraft(defaultAssigneeSalesId));
      return;
    }
    onItemsChange([...items, { ...draft, text: trimmed }]);
    // Genstart form-tilstanden så knappen kan tilføje endnu en uden
    // ekstra tryk. Brief: "Knappen bliver stående".
    setDraft(makeDraft(defaultAssigneeSalesId));
    setAdding(false);
  };

  const removeItem = (key: string) => {
    onItemsChange(items.filter((i) => i.key !== key));
  };

  const shortcutValue = matchShortcut(draft.dueDateIso);
  const showCustomDate = shortcutValue === CUSTOM_DATE;

  const assigneeValue =
    draft.assigneeSalesId != null ? String(draft.assigneeSalesId) : "__none__";

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const assignee = assignableUsers.find(
              (u) => u.salesId === item.assigneeSalesId,
            );
            return (
              <li
                key={item.key}
                className="flex items-start justify-between gap-2 rounded-md bg-[var(--surface)] px-3 py-2"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <div className="text-[var(--fg)]">{item.text}</div>
                  <div className="text-[13px] text-[var(--fg-2)]">
                    {formatDue(item.dueDateIso)}
                    {assignee && ` · ${assignee.name}`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 p-0"
                  onClick={() => removeItem(item.key)}
                  aria-label="Fjern opfølgning"
                >
                  <Icon icon={Trash2} size="sm" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border border-[var(--line)] p-3">
          <div className="space-y-1.5">
            <Label htmlFor="fu-text" className="text-sm">
              Hvad skal der ske?
            </Label>
            <Input
              id="fu-text"
              autoFocus
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder="Fx: sender prøver inden uge 34"
              className="min-h-11 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.text.trim()) {
                  e.preventDefault();
                  commitDraft();
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Hvornår</Label>
              <Select
                value={shortcutValue}
                onValueChange={(v) => {
                  if (v === NO_DATE) {
                    setDraft({ ...draft, dueDateIso: null });
                  } else if (v === CUSTOM_DATE) {
                    // Behold nuværende dato — sælgeren skal derefter
                    // skrive den præcise dag i det viste felt.
                    setDraft({
                      ...draft,
                      dueDateIso: draft.dueDateIso ?? isoAddDays(7),
                    });
                  } else {
                    const s = DATE_SHORTCUTS.find((x) => x.id === v);
                    if (s) setDraft({ ...draft, dueDateIso: isoAddDays(s.days) });
                  }
                }}
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_SHORTCUTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DATE}>Vælg dato…</SelectItem>
                  <SelectItem value={NO_DATE}>Ingen forfald</SelectItem>
                </SelectContent>
              </Select>
              {showCustomDate && (
                <Input
                  type="date"
                  value={draft.dueDateIso ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, dueDateIso: e.target.value || null })
                  }
                  className="min-h-11 text-sm"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Hvem</Label>
              <Select
                value={assigneeValue}
                onValueChange={(v) => {
                  const parsed = v === "__none__" ? null : Number(v);
                  setDraft({ ...draft, assigneeSalesId: parsed });
                }}
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u) => {
                    // Brief 42-korrektur: uden-login = grå og uvalgbar,
                    // ikke usynlig. Backoffice-køen forbliver valgbar.
                    const isDisabled = u.kind === "user" && !u.hasLogin;
                    return (
                      <SelectItem
                        key={u.key}
                        value={u.salesId != null ? String(u.salesId) : "__none__"}
                        disabled={isDisabled}
                      >
                        {u.name}
                        {u.kind === "me" && (
                          <span className="text-muted-foreground ml-1 text-sm">
                            (mig)
                          </span>
                        )}
                        {u.kind === "backoffice" && (
                          <span className="text-muted-foreground ml-1 text-sm">
                            (kø)
                          </span>
                        )}
                        {isDisabled && (
                          <span className="text-muted-foreground ml-1 text-sm">
                            (ingen invitation endnu)
                          </span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setDraft(makeDraft(defaultAssigneeSalesId));
              }}
            >
              Annullér
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={commitDraft}
              disabled={!draft.text.trim()}
            >
              Tilføj
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-[var(--fg-2)] hover:text-[var(--fg)]",
          )}
          onClick={() => {
            setDraft(makeDraft(defaultAssigneeSalesId));
            setAdding(true);
          }}
        >
          <Icon icon={Plus} size="sm" />
          Tilføj opfølgning
        </Button>
      )}
    </div>
  );
}

function formatDue(dateIso: string | null): string {
  if (!dateIso) return "uden forfald";
  const d = new Date(`${dateIso}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const days = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  const short = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
  }).format(d);
  if (days === 0) return `i dag · ${short}`;
  if (days === 1) return `i morgen · ${short}`;
  if (days > 1 && days < 14) return `om ${days} dage · ${short}`;
  if (days >= 14 && days < 60) {
    const w = Math.round(days / 7);
    return `om ${w} ${w === 1 ? "uge" : "uger"} · ${short}`;
  }
  return short;
}
