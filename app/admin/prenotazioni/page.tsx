import Link from "next/link";
import { CalendarDays, Mail, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UnifiedStatusBadge } from "@/components/shared/unified-status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/require-admin";
import { listLatestRequestsWithContext } from "@/server/requests/queries";

export const dynamic = "force-dynamic";

export default async function AdminPrenotazioniPage() {
  await requireAdmin();
  const rows = await listLatestRequestsWithContext(200);

  const byStatus = {
    received: rows.filter((r) => r.unifiedStatus === "received"),
    waitlisted: rows.filter((r) => r.unifiedStatus === "waitlisted"),
    to_pay: rows.filter((r) => r.unifiedStatus === "to_pay"),
    paid: rows.filter((r) => r.unifiedStatus === "paid"),
    paid_cancelled: rows.filter((r) => r.unifiedStatus === "paid_cancelled"),
    rejected: rows.filter((r) => r.unifiedStatus === "rejected"),
  };

  return (
    <>
      <PageHeader
        title="Prenotazioni"
        description="Tutte le richieste arrivate, raggruppate per stato. Clicca per aprire il dettaglio e gestire."
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Prenotazioni" },
        ]}
      />

      <Section
        title="Da valutare"
        hint="Richieste appena arrivate, in attesa di una tua decisione."
        rows={byStatus.received}
      />
      <Section
        title="Lista d'attesa"
        hint="Richieste messe in lista d'attesa, pronte da promuovere se si liberano posti."
        rows={byStatus.waitlisted}
      />
      <Section
        title="In attesa di pagamento"
        hint="Prenotazioni accettate, link di completamento aperto o pagamento in corso."
        rows={byStatus.to_pay}
      />
      <Section
        title="Pagate"
        hint="Prenotazioni confermate e saldate."
        rows={byStatus.paid}
      />
      {byStatus.paid_cancelled.length > 0 ? (
        <Section
          title="Cancellate dopo il pagamento"
          hint="Restano pagate ai fini contabili; l'email post-evento è sospesa."
          rows={byStatus.paid_cancelled}
        />
      ) : null}
      {byStatus.rejected.length > 0 ? (
        <Section
          title="Rifiutate"
          hint="Richieste declinate; storico consultabile."
          rows={byStatus.rejected}
        />
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessuna prenotazione ancora. Quando arriverà la prima richiesta dal
            modulo pubblico la vedrai qui.
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Section({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: Awaited<ReturnType<typeof listLatestRequestsWithContext>>;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {rows.length}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="divide-y">
        {rows.map((row) => (
          <Link
            key={row.request.id}
            href={`/admin/prenotazioni/${row.request.id}`}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium">
                {row.request.requester_first_name}{" "}
                {row.request.requester_last_name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  <Users className="mr-1 inline h-3 w-3" />
                  {row.booking?.people ?? row.request.people}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <CalendarDays className="mr-1 inline h-3 w-3" />
                {row.event.title} · {formatDateTime(row.event.starts_at)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                <Mail className="mr-1 inline h-3 w-3" />
                {row.request.requester_email} ·{" "}
                {formatDateTime(row.request.submitted_at)}
              </p>
            </div>
            <UnifiedStatusBadge status={row.unifiedStatus} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
