import { ChefHat, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, error } = await searchParams;

  const errorMessage =
    error === "not_admin"
      ? "Il tuo account non è autorizzato ad accedere al pannello."
      : error === "auth"
        ? "Sessione non valida, accedi di nuovo."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="text-left leading-tight">
            <p className="font-semibold">Cooker Loft</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Gestionale V1
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accesso amministratori</CardTitle>
            <p className="text-sm text-muted-foreground">
              Riservato al personale Cooker Loft autorizzato.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}
            <LoginForm next={next} />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Accesso protetto da Supabase Auth + lista admin_users.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
