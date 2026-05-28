import { cn } from "@/lib/utils";

type DataFieldProps = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
};

export function DataField({ label, value, mono, className }: DataFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "text-sm",
          mono && "font-mono text-xs",
          value === null || value === "" ? "text-muted-foreground italic" : ""
        )}
      >
        {value === null || value === undefined || value === ""
          ? "—"
          : value}
      </div>
    </div>
  );
}
