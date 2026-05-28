"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmbedCodeBlockProps = {
  label: string;
  value: string;
  className?: string;
};

export function EmbedCodeBlock({
  label,
  value,
  className,
}: EmbedCodeBlockProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast.success("Copiato negli appunti");
            } catch {
              toast.message("Copia manualmente il testo");
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copia
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
}
