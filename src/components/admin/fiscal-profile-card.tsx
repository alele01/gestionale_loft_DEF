import { Building2, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataField } from "@/components/shared/data-field";
import type { FiscalProfile } from "@/lib/mock/types";

export function FiscalProfileCard({
  profile,
}: {
  profile: FiscalProfile | null;
}) {
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati fiscali</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Non ancora raccolti. Verranno chiesti al referente nella pagina di
            completamento.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Dati fiscali</CardTitle>
          <Badge variant="outline" className="font-normal">
            {profile.kind === "private" ? (
              <>
                <User className="h-3 w-3" />
                Privato
              </>
            ) : (
              <>
                <Building2 className="h-3 w-3" />
                Azienda / Professionista
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <DataField label="Denominazione" value={profile.legalName} />
        {profile.kind === "private" ? (
          <DataField label="Codice fiscale" value={profile.taxCode} mono />
        ) : (
          <>
            <DataField label="Partita IVA" value={profile.vatNumber} mono />
            <DataField label="Codice destinatario SDI" value={profile.sdiCode} mono />
            <DataField label="PEC" value={profile.pecEmail} />
          </>
        )}
        <DataField
          label="Indirizzo"
          value={`${profile.address.street}, ${profile.address.zip} ${profile.address.city}${
            profile.address.province ? ` (${profile.address.province})` : ""
          } — ${profile.address.country}`}
          className="sm:col-span-2"
        />
        {profile.invoiceNote ? (
          <DataField
            label="Nota fattura"
            value={profile.invoiceNote}
            className="sm:col-span-2"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
