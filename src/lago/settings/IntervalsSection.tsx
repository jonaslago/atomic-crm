import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { Icon } from "@/lago/ui/Icon";

import { DEFAULT_INTERVALS_CONFIG } from "@/lago/customers/priority";

import { fetchVisitIntervals, saveVisitIntervals } from "./dataAccess";
import { visitIntervalsQueryKey } from "./useVisitIntervals";

/**
 * Domain-brief 11 · Sektion 1. Editable A/B/C intervals + soon-ratio.
 * On save we invalidate the shared react-query key so Dagens and the
 * customer list pick the new values up next tick — no reload needed.
 */
export function IntervalsSection({ isAdmin }: { isAdmin: boolean }) {
  const translate = useTranslate();
  const qc = useQueryClient();
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;
  const query = useQuery({
    queryKey: visitIntervalsQueryKey(),
    queryFn: fetchVisitIntervals,
  });

  const [aDays, setADays] = useState<string>(
    String(DEFAULT_INTERVALS_CONFIG.intervalDays.A),
  );
  const [bDays, setBDays] = useState<string>(
    String(DEFAULT_INTERVALS_CONFIG.intervalDays.B),
  );
  const [cDays, setCDays] = useState<string>(
    String(DEFAULT_INTERVALS_CONFIG.intervalDays.C),
  );
  const [soon, setSoon] = useState<string>(
    String(DEFAULT_INTERVALS_CONFIG.soonRatio),
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data && !dirty) {
      setADays(String(query.data.intervalDays.A));
      setBDays(String(query.data.intervalDays.B));
      setCDays(String(query.data.intervalDays.C));
      setSoon(String(query.data.soonRatio));
    }
  }, [query.data, dirty]);

  const mutation = useMutation({
    mutationFn: (config: Parameters<typeof saveVisitIntervals>[0]) =>
      saveVisitIntervals(config, currentSalesId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: visitIntervalsQueryKey() });
      qc.invalidateQueries({ queryKey: ["lago-felt-customers"] });
      qc.invalidateQueries({ queryKey: ["lago-customer-list"] });
      setDirty(false);
      toast.success(translate("lago.settings.intervals.saved"));
    },
    onError: (err) =>
      toast.error(translate("lago.settings.intervals.save_failed"), {
        description: readErrorMessage(err),
      }),
  });

  const submit = () => {
    const A = Number(aDays);
    const B = Number(bDays);
    const C = Number(cDays);
    const soonRatio = Number(soon);
    if (
      !Number.isFinite(A) ||
      A <= 0 ||
      !Number.isFinite(B) ||
      B <= 0 ||
      !Number.isFinite(C) ||
      C <= 0 ||
      !Number.isFinite(soonRatio) ||
      soonRatio <= 0 ||
      soonRatio > 1
    ) {
      toast.error(translate("lago.settings.intervals.invalid"));
      return;
    }
    mutation.mutate({ intervalDays: { A, B, C }, soonRatio });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {translate("lago.settings.intervals.section_title")}
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {translate("lago.settings.intervals.section_body")}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-4"
        >
          <IntervalField
            id="interval-a"
            label={translate("lago.settings.intervals.a_label")}
            value={aDays}
            disabled={!isAdmin}
            onChange={(v) => {
              setADays(v);
              setDirty(true);
            }}
          />
          <IntervalField
            id="interval-b"
            label={translate("lago.settings.intervals.b_label")}
            value={bDays}
            disabled={!isAdmin}
            onChange={(v) => {
              setBDays(v);
              setDirty(true);
            }}
          />
          <IntervalField
            id="interval-c"
            label={translate("lago.settings.intervals.c_label")}
            value={cDays}
            disabled={!isAdmin}
            onChange={(v) => {
              setCDays(v);
              setDirty(true);
            }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="soon-ratio" className="text-sm">
              {translate("lago.settings.intervals.soon_label")}
            </Label>
            <Input
              id="soon-ratio"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={soon}
              disabled={!isAdmin}
              onChange={(e) => {
                setSoon(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <p className="text-muted-foreground col-span-full text-sm">
            {translate("lago.settings.intervals.soon_hint")}
          </p>
          {isAdmin && (
            <div className="col-span-full">
              <Button
                type="submit"
                disabled={mutation.isPending || !dirty}
                className="gap-2 bg-[var(--a-deep)] text-white hover:bg-[var(--a-deep)]/90"
              >
                {mutation.isPending && (
                  <Icon icon={Loader2} className="animate-spin" />
                )}
                {translate("lago.settings.intervals.save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function IntervalField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step="1"
        min="1"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
