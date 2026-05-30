import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TotpEnrollForm } from "@/components/admin/totp-enroll-form";
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

export default async function Admin2FASetupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin({ skipMfa: true });
  const { next } = await searchParams;
  const target = safeNext(next);

  const supabase = await getServerSupabase();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Already fully authenticated (verified factor + elevated session).
  if (aal?.currentLevel === "aal2") {
    redirect(target);
  }
  // A factor already exists but isn't verified this session → just challenge.
  if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") {
    redirect(`/admin/2fa?next=${encodeURIComponent(target)}`);
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
              Configura la verifica in due passaggi
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attiva il 2FA</CardTitle>
            <p className="text-sm text-muted-foreground">
              Per sicurezza, ogni account admin deve usare la verifica in due
              passaggi. Configurala una volta: ti verrà chiesto il codice a ogni
              accesso.
            </p>
          </CardHeader>
          <CardContent>
            <TotpEnrollForm next={target} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
