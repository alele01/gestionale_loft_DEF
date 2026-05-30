import { PageHeader } from "@/components/shared/page-header";
import { RequestsBoard } from "@/components/admin/requests-board";
import { toRequestListItem } from "@/lib/request-list";
import { requireAdmin } from "@/server/auth/require-admin";
import { listLatestRequestsWithContext } from "@/server/requests/queries";

export const dynamic = "force-dynamic";

export default async function AdminPrenotazioniPage() {
  await requireAdmin();
  const rows = await listLatestRequestsWithContext(200);
  const items = rows.map(toRequestListItem);

  // Event filter options: every event that has at least one request, kept in
  // the order requests arrive (most recent first) and de-duplicated.
  const seen = new Set<string>();
  const events: { id: string; title: string }[] = [];
  for (const it of items) {
    if (seen.has(it.eventId)) continue;
    seen.add(it.eventId);
    events.push({ id: it.eventId, title: it.eventTitle });
  }
  events.sort((a, b) => a.title.localeCompare(b.title, "it"));

  return (
    <>
      <PageHeader
        title="Prenotazioni"
        description="Tutte le richieste arrivate. Filtra per stato o per evento; clicca una riga per aprire il dettaglio e gestire."
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Prenotazioni" },
        ]}
      />

      <RequestsBoard
        items={items}
        events={events}
        emptyLabel="Nessuna prenotazione ancora. Quando arriverà la prima richiesta dal modulo pubblico la vedrai qui."
      />
    </>
  );
}
