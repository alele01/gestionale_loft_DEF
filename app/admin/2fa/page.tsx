import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TotpChallengeForm } from "@/components/admin/totp-challenge-form";
import { requireAdmin } from "@/server/auth/require-admin";
import { getServerSupabase } from "@/server/supabase";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string }>;

function safeNext(next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/admin/dashboard";
  }
  return next;
}

export default async function Admin2FAPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin({ skipMfa: true });
  const { next } = await searchParams;
  const target = safeNext(next);

  const supabase = await getServerSupabase();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Already verified this session → go straight in.
  if (aal?.currentLevel === "aal2") {
    redirect(target);
  }
  // No factor enrolled yet → must set one up first.
  if (aal?.nextLevel === "aal1") {
    redirect(`/admin/2fa/setup?next=${encodeURIComponent(target)}`);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-left leading-tight">
            <p className="font-semibold">Cooker Loft</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Verifica in due passaggi
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inserisci il codice 2FA</CardTitle>
            <p className="text-sm text-muted-foreground">
              Apri la tua app authenticator e inserisci il codice a 6 cifre per
              completare l&apos;accesso.
            </p>
          </CardHeader>
          <CardContent>
            <TotpChallengeForm next={target} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
