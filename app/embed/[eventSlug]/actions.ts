"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  ConsentMissingError,
  NotFoundError,
  submitBookingRequest,
  ValidationError,
} from "@/modules/booking-state";
import { checkRateLimit, getClientIp } from "@/server/rate-limit/check";
import { getServiceClient } from "@/server/supabase";

/**
 * Helper: empty strings and absent form fields normalize to `undefined`,
 * which is what `.optional()` actually expects. Without this, `formData.get`
 * returns `null` (or `""`) and Zod's `z.string().optional()` rejects it.
 */
function optionalText(maxLen: number) {
  return z
    .preprocess((v) => {
      if (v === null || v === undefined) return undefined;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : t;
    }, z.string().max(maxLen).optional());
}

/**
 * Italian-friendly phone validator. Accepts international and national
 * formats, allows spaces / dashes / parens / dots, then strips them and
 * requires 8-15 digits (ITU-T E.164 range). Rejects strings that contain
 * letters or other unexpected characters.
 */
const PhoneSchema = z
  .string()
  .trim()
  .min(1, "Telefono richiesto")
  .refine((v) => /^[+()\d\s\-./]+$/.test(v), {
    message: "Caratteri non ammessi nel numero",
  })
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    },
    { message: "Numero non valido (servono tra 8 e 15 cifre)" }
  );

const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email richiesta")
  .email("Email non valida");

const SubmitSchema = z.object({
  eventId: z.string().uuid("Evento non valido"),
  firstName: z
    .string()
    .trim()
    .min(2, "Nome troppo corto")
    .max(100)
    .refine((v) => /\p{L}/u.test(v), { message: "Nome non valido" }),
  lastName: z
    .string()
    .trim()
    .min(2, "Cognome troppo corto")
    .max(100)
    .refine((v) => /\p{L}/u.test(v), { message: "Cognome non valido" }),
  email: EmailSchema,
  phone: PhoneSchema,
  people: z.coerce
    .number({ message: "Indica il numero di persone" })
    .int("Solo numeri interi")
    .min(1, "Minimo 1 persona")
    .max(50, "Massimo 50 persone"),
  dietaryNotes: optionalText(2000),
  specialOccasion: optionalText(500),
  consentTerms: z.literal("on", { message: "Conferma richiesta" }),
  consentPrivacy: z.literal("on", { message: "Conferma richiesta" }),
  consentHealth: z.literal("on", { message: "Conferma richiesta" }),
});

export type SubmitRequestState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "ok"; requestId: string; people: number };

export async function submitRequestAction(
  _prev: SubmitRequestState,
  formData: FormData
): Promise<SubmitRequestState> {
  // Anti-abuse soft throttle. Scope: stop one client (or carrier-grade
  // NAT cluster) from monopolising the DB during burst traffic. NOT a
  // DDoS shield — Vercel/CDN handles that upstream.
  //
  // The caps are intentionally GENEROUS because during a campaign launch
  // many real users can share the same egress IP (mobile carriers,
  // corporate proxies, school/hotel Wi-Fi). A legitimate human submits
  // 1-2 requests; the cap kicks in only on automated abuse.
  //
  //   - 60 submits / minute per IP   (≈ 1/sec sustained — covers NAT)
  //   - 600 submits / hour   per IP  (≈ 10/min sustained — covers
  //     "office hotspot" + retries)
  //
  // Degrade-open: if Postgres errors out we let the request through, so
  // a DB incident never blocks new bookings.
  const submitterIp = await getClientIp();
  const burst = await checkRateLimit({
    action: "embed_submit_minute",
    identifier: `ip:${submitterIp}`,
    windowSeconds: 60,
    maxHits: 60,
  });
  if (!burst.allowed) {
    return {
      status: "error",
      message:
        "Troppe richieste in poco tempo. Aspetta un minuto e riprova.",
    };
  }
  const hourly = await checkRateLimit({
    action: "embed_submit_hour",
    identifier: `ip:${submitterIp}`,
    windowSeconds: 3600,
    maxHits: 600,
  });
  if (!hourly.allowed) {
    return {
      status: "error",
      message:
        "Hai inviato troppe richieste in un'ora. Riprova più tardi.",
    };
  }

  const parsed = SubmitSchema.safeParse({
    eventId: formData.get("eventId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    people: formData.get("people"),
    dietaryNotes: formData.get("dietaryNotes"),
    specialOccasion: formData.get("specialOccasion"),
    consentTerms: formData.get("consentTerms"),
    consentPrivacy: formData.get("consentPrivacy"),
    consentHealth: formData.get("consentHealth"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_root");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const consentMissing =
      fieldErrors.consentTerms ||
      fieldErrors.consentPrivacy ||
      fieldErrors.consentHealth;
    // eslint-disable-next-line no-console
    console.warn("[embed] submitRequest validation failed:", fieldErrors);
    return {
      status: "error",
      message: consentMissing
        ? "Devi accettare tutte le condizioni richieste."
        : "Controlla i dati inseriti.",
      fieldErrors,
    };
  }
  const values = parsed.data;

  // Server-side capture of IP + UA per docs/SECURITY.md §4.
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0].trim() : null) ?? h.get("x-real-ip") ?? "0.0.0.0";
  const userAgent = h.get("user-agent") ?? "unknown";

  // Pull current consent versions from app_settings so we snapshot the
  // version the requester actually agreed to.
  const settingsRes = await getServiceClient()
    .from("app_settings")
    .select("terms_version, privacy_version, health_consent_version")
    .eq("id", 1)
    .maybeSingle();
  if (settingsRes.error || !settingsRes.data) {
    return { status: "error", message: "Configurazione non disponibile" };
  }

  try {
    const result = await submitBookingRequest({
      eventId: values.eventId,
      requesterFirstName: values.firstName,
      requesterLastName: values.lastName,
      requesterEmail: values.email,
      requesterPhone: values.phone,
      people: values.people,
      dietaryNotes: values.dietaryNotes ?? null,
      specialOccasion: values.specialOccasion ?? null,
      notes: null,
      source: "embed",
      ipAddress: ip,
      userAgent,
      consentTermsVersion: settingsRes.data.terms_version,
      consentPrivacyVersion: settingsRes.data.privacy_version,
      consentHealthVersion: settingsRes.data.health_consent_version,
    });
    return { status: "ok", requestId: result.request.id, people: values.people };
  } catch (err) {
    if (err instanceof ConsentMissingError) {
      return { status: "error", message: err.message };
    }
    if (err instanceof NotFoundError) {
      return { status: "error", message: err.message };
    }
    if (err instanceof ValidationError) {
      return { status: "error", message: err.message };
    }
    // eslint-disable-next-line no-console
    console.error("[embed] submitRequest failed", err);
    return {
      status: "error",
      message: "Errore inatteso. Riprova tra qualche minuto.",
    };
  }
}
