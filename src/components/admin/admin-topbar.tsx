import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

type Identity = {
  user: { email: string };
  adminUser: { email: string; role: string };
} | null;

export function AdminTopbar({ identity }: { identity: Identity }) {
  const email = identity?.user.email ?? null;
  const initials = (email ?? "?")
    .split(/[.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Cooker Loft V1 — pannello amministrazione
        </span>
      </div>
      <div className="flex items-center gap-3">
        {email ? (
          <>
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium text-foreground">{email}</div>
              <div className="text-muted-foreground">Amministratore</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <form action="/admin/logout" method="post">
              <Button type="submit" variant="ghost" size="icon" aria-label="Esci">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Non autenticato</span>
        )}
      </div>
    </header>
  );
}
