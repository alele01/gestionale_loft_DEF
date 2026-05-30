import Image from "next/image";

/**
 * Cooker Loft logo header shown on the customer-facing pages (embed
 * request form + completion form + payment surfaces). Compact and
 * iframe-friendly.
 */
export function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <Image
        src="/brand/cooker-loft-logo.png"
        alt="Cooker Loft"
        width={1017}
        height={298}
        priority
        className="h-9 w-auto sm:h-11"
      />
      {subtitle ? (
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
