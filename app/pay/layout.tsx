import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </div>
  );
}
