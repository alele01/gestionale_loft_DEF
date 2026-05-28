import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold">Pagina non trovata</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;elemento richiesto non esiste in questo mockup statico.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/admin/dashboard">Vai alla dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/events">Apri eventi</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
