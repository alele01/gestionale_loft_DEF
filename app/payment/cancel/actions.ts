"use server";

import { redirect } from "next/navigation";

import {
  BookingStateError,
  recreateCheckoutSession,
} from "@/modules/booking-state";

/**
 * Self-service "Riprova pagamento" from /payment/cancel.
 *
 * Important: this server action does NOT require a token because the
 * user already proved ownership by completing the booking (they had the
 * completion token at that point) and Stripe redirected them back to a
 * domain we control. The bookingId is itself NOT a credential, so we
 * pair it with a state check inside `recreateCheckoutSession` to refuse
 * any booking not in `awaiting_payment`.
 *
 * Note on `redirect()` placement: Next signals redirects by throwing a
 * special exception (`NEXT_REDIRECT`). Calling `redirect()` from inside
 * a `try` block would let our own `catch` swallow it. We resolve the
 * target URL first and call `redirect()` only afterwards.
 */
export async function resumePaymentAction(formData: FormData): Promise<never> {
  const bookingId = String(formData.get("bookingId") ?? "");
  let targetUrl = "/payment/cancel";

  if (bookingId) {
    try {
      const result = await recreateCheckoutSession({
        bookingId,
        actor: { type: "representative" },
      });
      targetUrl = result.checkoutUrl;
    } catch (err) {
      if (!(err instanceof BookingStateError)) {
        // eslint-disable-next-line no-console
        console.error("[payment/cancel] recreateCheckoutSession failed", err);
      }
      // fall through with targetUrl = /payment/cancel
    }
  }

  redirect(targetUrl);
}
