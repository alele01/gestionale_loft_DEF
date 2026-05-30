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
      {/*
        Flush, padding-free shell. The embedded (compact) form sits directly
        on the host page; the direct-link request page paints its own warm
        full-screen background + padding via its internal PageShell.
      */}
      <div
        className={`cooker-brand bg-transparent text-foreground ${brandFont.className}`}
      >
        {children}
      </div>
    </>
  );
}
