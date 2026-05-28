import { PageHeader } from "@/components/shared/page-header";
import { EventForm } from "@/components/admin/event-form";
import { requireAdmin } from "@/server/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Nuovo evento"
        description="Compila i campi qui sotto. L'evento viene creato come bozza: lo pubblichi dal dettaglio quando è pronto."
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Eventi", href: "/admin/events" },
          { label: "Nuovo evento" },
        ]}
      />
      <EventForm mode="create" />
    </>
  );
}
