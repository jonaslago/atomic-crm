import { cn } from "@/lib/utils";

/**
 * Brief 58 §2 (17. sep 2026) · fælles filter-primitiver.
 *
 * Én kilde til FilterGroup, RadioRow, CheckboxRow, ToggleRow. Bruges af
 * både kundelistens skinne og kontakternes skinne, så en ændring
 * (fx 32 px med mus, 44 px uden) rammer begge samtidig.
 *
 * Rækkehøjden: `min-h-11` (44 px) er standard for touch. På skærme med
 * mus (`@media (hover: hover) and (pointer: fine)`) reduceres til
 * `min-h-8` (32 px) — 44 px-reglen kom fra Stitchs touch-skærme og er
 * ren spildplads på PC. Tailwind har ingen `hover-hover:`-utility som
 * standard, så vi bruger arbitrary variant.
 *
 * Brief 58 tillæg B (17. sep 2026): whitespace i arbitrary variants skal
 * skrives som `_`. Uden underscores bliver `(hover:hover)and(pointer:fine)`
 * ugyldig CSS (mangler luft omkring `and`) og Tailwind genererer INGEN
 * regel — klassen står i markup, men CSS-en er død. Verificeret via
 * `getComputedStyle`. Samme fejlmønster som brief 49 §1's `text-[var(--t-body)]`
 * der blev læst som farve i stedet for font-size. Regel i DIVERGENCE.md:
 * en vilkårlig Tailwind-værdi tæller ikke som bygget før den er efterprøvet
 * i browseren.
 */

const TOUCH_TARGET =
  "min-h-11 [@media(hover:hover)_and_(pointer:fine)]:min-h-8";

export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // Brief 58 tillæg B (17. sep 2026): overskriftens `mb-1` er fjernet.
  // Med seks grupper i kundelistens skinne (mod fire i kontakters)
  // læses skinnen som seks blokke i stedet for én, hvis der er luft
  // både under overskriften og imellem grupperne. Kompakthed slår
  // symmetri her — Kontakter-skinnen bliver skabelonen.
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export function RadioRow({
  name,
  label,
  value,
  selected,
  onSelect,
  count,
  countTone,
  hint,
}: {
  name: string;
  label: string;
  value: string;
  selected: string;
  onSelect: (v: string) => void;
  count: number;
  countTone?: "red" | "amber";
  /** §22 (29. sep 2026): kort forklaring under label — bruges når to
   *  filtre ligner hinanden (fx Ringeliste og Overskredet interval). */
  hint?: string;
}) {
  const isSelected = selected === value;
  return (
    <label
      className={cn(
        "flex items-start justify-between gap-3 py-1 cursor-pointer",
        TOUCH_TARGET,
        isSelected ? "text-[var(--fg)]" : "text-[var(--fg-2)]",
        "hover:text-[var(--fg)]",
      )}
    >
      <span className="flex min-w-0 items-start gap-2">
        <input
          type="radio"
          name={name}
          checked={isSelected}
          onChange={() => onSelect(value)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--ink)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          {hint && (
            <span className="mt-0.5 block text-[11px] leading-tight text-[var(--fg-3)]">
              {hint}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 pt-0.5 text-[length:var(--t-meta)] tabular-nums",
          countTone === "red"
            ? "font-medium text-[var(--st-red-fg)]"
            : countTone === "amber"
              ? "font-medium text-[var(--st-amber-fg)]"
              : "text-[var(--fg-3)]",
        )}
      >
        {count}
      </span>
    </label>
  );
}

export function CheckboxRow({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count: number;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 py-1 cursor-pointer",
        TOUCH_TARGET,
        checked ? "text-[var(--fg)]" : "text-[var(--fg-2)]",
        "hover:text-[var(--fg)]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--ink)]"
        />
        <span className="truncate text-sm">{label}</span>
      </span>
      <span className="shrink-0 text-[length:var(--t-meta)] tabular-nums text-[var(--fg-3)]">
        {count}
      </span>
    </label>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 py-1 text-[var(--fg)] cursor-pointer",
        TOUCH_TARGET,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 cursor-pointer accent-[var(--ink)]"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
