import { useQuery } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import { da } from "date-fns/locale";
import { FileText, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useGetIdentity, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

interface DashboardNote {
  id: number;
  company_id: number;
  contact_id: number | null;
  text: string;
  created_at: string;
  company: { id: number; name: string } | null;
  contact: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

async function fetchRecentLagoNotes(
  salesId: number | null,
  limit = 5,
): Promise<DashboardNote[]> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from("company_notes_lago")
    .select(
      "id, company_id, contact_id, text, created_at, company:companies(id,name), contact:contacts(id,first_name,last_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (salesId != null) {
    q = q.eq("sales_id", salesId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as DashboardNote[]) ?? [];
}

function contactLabel(c: DashboardNote["contact"]): string | null {
  if (!c) return null;
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || `#${c.id}`;
}

/**
 * Dashboard widget that shows the current user's most recent LAGO
 * company-level notes. Replaces upstream's "Latest Notes" / activity log
 * for note visibility, since company_notes_lago is invisible to upstream
 * widgets.
 */
export function LagoLatestNotesPanel({ limit = 5 }: { limit?: number }) {
  const translate = useTranslate();
  const { data: identity, isPending: identityPending } = useGetIdentity();
  const salesId = typeof identity?.id === "number" ? identity.id : null;

  const query = useQuery({
    queryKey: ["lago-dashboard-notes", salesId, limit],
    queryFn: () => fetchRecentLagoNotes(salesId, limit),
    enabled: !identityPending,
  });

  return (
    <div>
      <div className="mb-4 flex items-center">
        <div className="mr-3 flex">
          <FileText className="text-muted-foreground h-6 w-6" />
        </div>
        <h2 className="text-muted-foreground text-xl font-semibold">
          {translate("lago.dashboard.latest_notes_title")}
        </h2>
      </div>
      <Card>
        <CardContent className="py-4">
          {query.isLoading ? (
            <p className="text-muted-foreground text-sm">
              {translate("lago.dashboard.loading")}
            </p>
          ) : query.error ? (
            <p className="text-destructive text-sm">
              {translate("lago.dashboard.load_failed")}
            </p>
          ) : !query.data || query.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {translate("lago.dashboard.no_notes_yet")}
            </p>
          ) : (
            <ul className="space-y-4">
              {query.data.map((note) => {
                const contact = contactLabel(note.contact);
                const ago = formatDistance(
                  new Date(note.created_at),
                  new Date(),
                  { addSuffix: true, locale: da },
                );
                return (
                  <li
                    key={note.id}
                    className="border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <MessageSquare className="h-3 w-3" />
                      {note.company ? (
                        <Link
                          to={`/companies/${note.company.id}/show`}
                          className="text-primary font-medium underline-offset-2 hover:underline"
                        >
                          {note.company.name}
                        </Link>
                      ) : (
                        <span className="italic">
                          {translate("lago.dashboard.unknown_company")}
                        </span>
                      )}
                      <span>·</span>
                      <span>{ago}</span>
                      {contact && (
                        <Badge variant="outline" className="font-normal">
                          {translate("lago.customer.note.about_contact", {
                            name: contact,
                          })}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {note.text}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
