import type { Metadata } from "next";

import { BrandHeader } from "@/components/brand/brand-header";
import { brandFont } from "@/lib/brand-font";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`cooker-brand min-h-screen bg-gradient-to-b from-[#fffaf7] to-[#fde5d4] px-4 py-10 text-foreground sm:py-16 ${brandFont.className}`}
    >
      <div className="mx-auto w-full max-w-lg">
        <BrandHeader subtitle="Pagamento" />
        {children}
      </div>
    </div>
  );
}
