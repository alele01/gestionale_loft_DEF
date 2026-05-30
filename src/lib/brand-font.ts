import { Montserrat } from "next/font/google";

/**
 * Cooker Loft brand typeface (Montserrat). Applied only on the
 * customer-facing surfaces via `.className` on the embed/completion
 * layout wrappers — the admin UI keeps the default system sans stack.
 */
export const brandFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
