import type { Metadata } from "next";

import { brandFont } from "@/lib/brand-font";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`cooker-brand min-h-screen bg-gradient-to-b from-[#fffaf7] to-[#fde5d4] px-4 py-6 text-foreground sm:px-6 sm:py-10 ${brandFont.className}`}
    >
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  );
}
