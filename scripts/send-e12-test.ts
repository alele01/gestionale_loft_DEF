/* eslint-disable no-console */
/**
 * One-off: send a sample E12 to verify copy/layout.
 *
 *   NODE_OPTIONS='--require ./scripts/mock-server-only.cjs' npx tsx --env-file=.env.local scripts/send-e12-test.ts
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import { sendE12BookingVoided } from "../src/server/email/senders/send-e12";

const TO = "ale@alpistudio.eu";

async function main() {
  const result = await sendE12BookingVoided({
    bookingId: "00000000-0000-4000-8000-000000000e12",
    requesterFirstName: "Alessandro",
    requesterEmail: TO,
    eventTitle: "FERMENTO | Tutti i segreti del mio pane",
    eventStartsAt: "2026-06-12T14:00:00.000Z",
    people: 2,
  });

  console.log("E12 test send result:", result);
  if (result.status === "failed") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
