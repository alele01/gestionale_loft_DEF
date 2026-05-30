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
        className={`cooker-brand bg-transparent px-2 py-3 text-foreground sm:px-4 sm:py-4 ${brandFont.className}`}
      >
        <div className="mx-auto w-full max-w-xl">{children}</div>
      </div>
    </>
  );
}
