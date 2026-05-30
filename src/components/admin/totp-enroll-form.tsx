"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  startTotpEnrollmentAction,
  verifyTotpEnrollmentAction,
} from "../../../app/admin/2fa/actions";

type EnrollState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; factorId: string; qrCode: string; secret: string };

export function TotpEnrollForm({ next }: { next: string }) {
  const router = useRouter();
  const [enroll, setEnroll] = React.useState<EnrollState>({ kind: "loading" });
  const [code, setCode] = React.useState("");
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Guards React 18 StrictMode double-invoke so we enroll only once.
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const result = await startTotpEnrollmentAction();
      if (result.status === "error") {
        setEnroll({ kind: "error", message: result.message });
        return;
      }
      setEnroll({
        kind: "ready",
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
      });
    })();
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enroll.kind !== "ready") return;
    setVerifyError(null);
    const factorId = enroll.factorId;
    startTransition(async () => {
      const result = await verifyTotpEnrollmentAction(factorId, code);
      if (result.status === "error") {
        setVerifyError(result.message);
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  if (enroll.kind === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Generazione del codice QR in corso…
      </p>
    );
  }

  if (enroll.kind === "error") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {enroll.message}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            startedRef.current = false;
            setEnroll({ kind: "loading" });
            startedRef.current = true;
            startTotpEnrollmentAction().then((result) => {
              if (result.status === "error") {
                setEnroll({ kind: "error", message: result.message });
              } else {
                setEnroll({
                  kind: "ready",
                  factorId: result.factorId,
                  qrCode: result.qrCode,
                  secret: result.secret,
                });
              }
            });
          }}
        >
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          Installa un&apos;app authenticator (Google Authenticator, Microsoft
          Authenticator, Authy, 1Password…).
        </li>
        <li>Inquadra il QR code qui sotto con l&apos;app.</li>
        <li>Inserisci il codice a 6 cifre generato dall&apos;app.</li>
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-md border bg-card p-4">
        {/* QR is a Supabase-generated SVG data URL; next/image can't parse
            data: sources, so a plain img is the right tool here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enroll.qrCode}
          alt="QR code per la configurazione 2FA"
          width={192}
          height={192}
          className="h-48 w-48"
        />
        <div className="w-full space-y-1 text-center">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Non riesci a inquadrarlo? Inserisci manualmente questa chiave:
          </p>
          <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
            {enroll.secret}
          </code>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="totp-enroll">Codice di verifica</Label>
          <Input
            id="totp-enroll"
            name="totp-enroll"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="text-center font-mono text-lg tracking-[0.4em]"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
        {verifyError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {verifyError}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={pending || code.length !== 6}
        >
          {pending ? "Attivazione in corso…" : "Attiva 2FA e accedi"}
        </Button>
      </form>
    </div>
  );
}
