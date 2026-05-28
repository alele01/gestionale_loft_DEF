"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  saveSettingsAction,
  type SettingsState,
} from "../../server/settings/actions";

export type SettingsFormInitial = {
  accountantEmail: string;
  reviewUrl: string | null;
  reviewEmailEnabled: boolean;
  requesterReceiptEmailEnabled: boolean;
  adminNewRequestEmailEnabled: boolean;
  termsVersion: string;
  privacyVersion: string;
  healthConsentVersion: string;
  imageUseConsentVersion: string;
  clauses1341_1342Version: string;
  completionWindowHours: number;
  paymentWindowHours: number;
};

const initialState: SettingsState = { status: "idle" };

export function SettingsForm({ initial }: { initial: SettingsFormInitial }) {
  const [state, formAction] = useActionState(saveSettingsAction, initialState);
  const [reviewEmailEnabled, setReviewEmailEnabled] = React.useState(
    initial.reviewEmailEnabled
  );
  const [requesterReceiptEnabled, setRequesterReceiptEnabled] = React.useState(
    initial.requesterReceiptEmailEnabled
  );
  const [adminNotifyEnabled, setAdminNotifyEnabled] = React.useState(
    initial.adminNewRequestEmailEnabled
  );

  React.useEffect(() => {
    if (state.status === "ok") {
      toast.success("Impostazioni salvate");
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invio al commercialista</CardTitle>
          <p className="text-xs text-muted-foreground">
            L&apos;indirizzo a cui inviamo i file delle prenotazioni pagate.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="accountantEmail"
            label="Email del commercialista"
            error={fieldErrors.accountantEmail}
            sm
          >
            <Input
              id="accountantEmail"
              name="accountantEmail"
              type="email"
              defaultValue={initial.accountantEmail}
              required
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Email post-evento al richiedente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Il giorno dopo l&apos;evento mandiamo un&apos;email di ringraziamento
            con il link per lasciare una recensione su Google.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label htmlFor="reviewEmailEnabled" className="text-sm font-medium">
                Attiva l&apos;email post-evento
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Se la spegni, nessuna email post-evento viene inviata.
              </p>
            </div>
            <Switch
              id="reviewEmailEnabled"
              name="reviewEmailEnabled"
              checked={reviewEmailEnabled}
              onCheckedChange={setReviewEmailEnabled}
            />
          </div>
          <FormField
            id="reviewUrl"
            label="Link per lasciare una recensione"
            error={fieldErrors.reviewUrl}
            hint="Se il link è vuoto, l'email post-evento non viene inviata."
          >
            <Input
              id="reviewUrl"
              name="reviewUrl"
              type="url"
              defaultValue={initial.reviewUrl ?? ""}
              placeholder="https://g.page/r/..."
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifiche email opzionali</CardTitle>
          <p className="text-xs text-muted-foreground">
            Email aggiuntive che puoi attivare a piacere. Sono spente di
            default per non sommergere richiedenti e amministratori.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label
                htmlFor="requesterReceiptEmailEnabled"
                className="text-sm font-medium"
              >
                Conferma di ricezione al richiedente (E1)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Quando arriva una nuova richiesta, manda al richiedente
                un&apos;email di cortesia: &ldquo;Abbiamo ricevuto la tua
                richiesta&rdquo;. Non contiene link di pagamento.
              </p>
            </div>
            <Switch
              id="requesterReceiptEmailEnabled"
              name="requesterReceiptEmailEnabled"
              checked={requesterReceiptEnabled}
              onCheckedChange={setRequesterReceiptEnabled}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label
                htmlFor="adminNewRequestEmailEnabled"
                className="text-sm font-medium"
              >
                Notifica nuova richiesta agli amministratori (E8)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Quando arriva una nuova richiesta, manda un&apos;email a tutti
                gli amministratori configurati nel gestionale, con il link
                diretto alla scheda della richiesta.
              </p>
            </div>
            <Switch
              id="adminNewRequestEmailEnabled"
              name="adminNewRequestEmailEnabled"
              checked={adminNotifyEnabled}
              onCheckedChange={setAdminNotifyEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Versioni dei documenti legali
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ogni accettazione viene marcata con la versione qui indicata.
            Aggiornala solo quando cambi davvero i testi.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <VersionField
            id="termsVersion"
            name="termsVersion"
            label="Condizioni generali"
            defaultValue={initial.termsVersion}
            error={fieldErrors.termsVersion}
          />
          <VersionField
            id="privacyVersion"
            name="privacyVersion"
            label="Informativa privacy"
            defaultValue={initial.privacyVersion}
            error={fieldErrors.privacyVersion}
          />
          <VersionField
            id="healthConsentVersion"
            name="healthConsentVersion"
            label="Trattamento dati salute"
            defaultValue={initial.healthConsentVersion}
            error={fieldErrors.healthConsentVersion}
          />
          <VersionField
            id="imageUseConsentVersion"
            name="imageUseConsentVersion"
            label="Utilizzo immagine"
            defaultValue={initial.imageUseConsentVersion}
            error={fieldErrors.imageUseConsentVersion}
          />
          <VersionField
            id="clauses1341_1342Version"
            name="clauses1341_1342Version"
            label="Clausole vessatorie (artt. 1341/1342 c.c.)"
            defaultValue={initial.clauses1341_1342Version}
            error={fieldErrors.clauses1341_1342Version}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva impostazioni"}
    </Button>
  );
}

function FormField({
  id,
  label,
  hint,
  error,
  sm,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  sm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${sm ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function VersionField({
  id,
  name,
  label,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <Input id={id} name={name} defaultValue={defaultValue} className="font-mono text-xs" />
    </FormField>
  );
}
