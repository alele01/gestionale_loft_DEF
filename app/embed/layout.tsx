import type { Metadata } from "next";

import { brandFont } from "@/lib/brand-font";
import { EmbedAutoResize } from "@/components/embed/embed-auto-resize";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
        Transparent document background so the embed blends into the host
        site instead of sitting on its own coloured panel. Scoped to the
        embed document only (this layout renders just for /embed/*).
      */}
      <style>{`html,body{background:transparent !important;}`}</style>
      <EmbedAutoResize />
      <div
        className={`cooker-brand bg-transparent py-2 text-foreground ${brandFont.className}`}
      >
        <div className="w-full">{children}</div>
      </div>
    </>
  );
}
