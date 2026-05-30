import { Roboto } from "next/font/google";

/**
 * Cooker Loft brand typeface (Roboto), matching the legacy single-event
 * page. Applied only on the customer-facing surfaces via `.className` on
 * the embed/completion layout wrappers — the admin UI keeps the default
 * system sans stack.
 */
export const brandFont = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});
