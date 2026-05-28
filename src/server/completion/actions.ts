"use server";

import { headers } from "next/headers";

import {
  BookingStateError,
  completeBooking,
} from "@/modules/booking-state";
import { checkRateLimit, getClientIp } from "@/server/rate-limit/check";
import { getServiceClient } from "@/server/supabase";

import { CompletionFormSchema } from "./schema";

export type CompletionActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "ok"; bookingId: string; checkoutUrl: string };

export async function completeBookingAction(
  _prev: CompletionActionState,
  formData: FormData
): Promise<CompletionActionState> {
  // Anti-abuse soft throttle. Same philosophy as the embed submit
  // action: caps are generous (covers NAT clusters, corporate proxies,
  // hotspot Wi-Fi during a launch). We trip ONLY on automated abuse.
  //
  //   - 60 submits / minute per IP  (covers carrier NAT)
  //   - 100 submits / hour  per token-prefix (a real user retries a
  //     few times if they fat-finger the form; 100 is far above that
  //     and below what a probing bot would hit)
  //
  // Degrade-open on DB errors.
  const ip = await getClientIp();
  const tokenRaw = formData.get("token");
  const tokenFingerprint =
    typeof tokenRaw === "string" && tokenRaw.length >= 8
      ? tokenRaw.slice(0, 8)
      : "missing";
  const ipBurst = await checkRateLimit({
    action: "complete_booking_ip",
    identifier: `ip:${ip}`,
    windowSeconds: 60,
    maxHits: 60,
  });
  if (!ipBurst.allowed) {
    return {
      status: "error",
      message:
        "Troppi tentativi in poco tempo. Aspetta un minuto e riprova.",
    };
  }
  const tokenBurst = await checkRateLimit({
    action: "complete_booking_token",
    identifier: `tok:${tokenFingerprint}`,
    windowSeconds: 3600,
    maxHits: 100,
  });
  if (!tokenBurst.allowed) {
    return {
      status: "error",
      message:
        "Troppi tentativi su questo link. Contatta lo staff se il problema persiste.",
    };
  }

  const parsed = CompletionFormSchema.safeParse({
    token: formData.get("token"),
    fiscalKind: formData.get("fiscalKind"),
    legalName: formData.get("legalName"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    taxCode: formData.get("taxCode"),
    vatNumber: formData.get("vatNumber"),
    addressStreet: formData.get("addressStreet"),
    addressZip: formData.get("addressZip"),
    addressCity: formData.get("addressCity"),
    addressProvince: formData.get("addressProvince"),
    addressCountry: formData.get("addressCountry") || "IT",
    sdiCode: formData.get("sdiCode"),
    pecEmail: formData.get("pecEmail"),

    participantsKind: formData.get("participantsKind"),
    otherParticipantsNames: formData.get("otherParticipantsNames"),
    allergiesPresent: formData.get("allergiesPresent"),
    allergiesDetails: formData.get("allergiesDetails"),

    minorsIncluded: formData.get("minorsIncluded"),
    minorsNames: formData.get("minorsNames"),
    guardianName: formData.get("guardianName"),
    minorAllergiesPresent: formData.get("minorAllergiesPresent"),
    minorAllergiesConfirmed: formData.get("minorAllergiesConfirmed"),

    consentTerms: formData.get("consentTerms"),
    consentClauses: formData.get("consentClauses"),
    consentPrivacy: formData.get("consentPrivacy"),
    consentAllergiesDeclaration: formData.get("consentAllergiesDeclaration"),
    consentRepresentative: formData.get("consentRepresentative"),
    consentInformOthers: formData.get("consentInformOthers"),
    consentImageUse: formData.get("consentImageUse"),
    consentMinorParental: formData.get("consentMinorParental"),
    consentMinorImageUse: formData.get("consentMinorImageUse"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_root");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Controlla i dati inseriti.",
      fieldErrors,
    };
  }
  const values = parsed.data;

  const h = await headers();
  const userAgent = h.get("user-agent") ?? "unknown";

  const settingsRes = await getServiceClient()
    .from("app_settings")
    .select(
      "terms_version, privacy_version, health_consent_version, image_use_consent_version, clauses_1341_1342_version"
    )
    .eq("id", 1)
    .maybeSingle();
  if (settingsRes.error || !settingsRes.data) {
    return { status: "error", message: "Configurazione non disponibile" };
  }
  const settings = settingsRes.data;
  const now = new Date().toISOString();

  const declaredHealthData =
    values.allergiesPresent === "yes" ||
    (values.minorsIncluded === "yes" &&
      values.minorAllergiesPresent === "yes");

  try {
    // For private buyers we synthesise `legalName` from first+last so the
    // existing email / UI paths (which display fiscalLegalName) keep
    // working without ad-hoc branching. The dedicated firstName/lastName
    // fields are persisted in fiscal_profiles for FatturaPA XML
    // generation (Anagrafica.Nome / Anagrafica.Cognome).
    const resolvedLegalName =
      values.fiscalKind === "private"
        ? `${values.firstName ?? ""} ${values.lastName ?? ""}`.trim()
        : (values.legalName ?? "").trim();

    const result = await completeBooking({
      tokenPlaintext: values.token,
      actor: { type: "representative" },
      fiscal: {
        kind: values.fiscalKind,
        legalName: resolvedLegalName,
        firstName: values.firstName ?? null,
        lastName: values.lastName ?? null,
        taxCode: values.taxCode ?? null,
        vatNumber: values.vatNumber ?? null,
        addressStreet: values.addressStreet,
        addressCity: values.addressCity,
        addressZip: values.addressZip,
        addressProvince: values.addressProvince ?? null,
        addressCountry: values.addressCountry,
        sdiCode: values.sdiCode ?? null,
        pecEmail: values.pecEmail ?? null,
        invoiceNote: null,
      },
      consents: {
        legalAcceptedAt: now,
        privacyAcceptedAt: now,
        healthConsentAcceptedAt: declaredHealthData ? now : null,
        imageUseChoice: values.consentImageUse ? "accept" : "decline",
        ip,
        userAgent,
        versions: {
          terms: settings.terms_version,
          privacy: settings.privacy_version,
          health: settings.health_consent_version,
          image_use: settings.image_use_consent_version,
          clauses_1341_1342: settings.clauses_1341_1342_version,
        },
      },
      participants: {
        kind: values.participantsKind,
        otherParticipantsNames: values.otherParticipantsNames ?? null,
        allergiesPresent: values.allergiesPresent,
        allergiesDetails: values.allergiesDetails ?? null,
        // Always true here — the schema enforces it on submission.
        consentAllergiesDeclaration: values.consentAllergiesDeclaration === "on",
        consentRepresentative: values.consentRepresentative,
        consentInformOthers: values.consentInformOthers,
      },
      minors: {
        included: values.minorsIncluded,
        minorsNames: values.minorsNames ?? null,
        guardianName: values.guardianName ?? null,
        allergiesPresent: values.minorAllergiesPresent ?? null,
        // The minor's specific allergies are not free-text anymore: the
        // user only confirms they are within the ones already declared
        // in the original request (stored on booking.dietary_notes).
        allergiesConfirmedInRequest: values.minorAllergiesConfirmed,
        consentParental: values.consentMinorParental,
        consentImageUse: values.consentMinorImageUse,
      },
    });

    return {
      status: "ok",
      bookingId: result.booking.id,
      checkoutUrl: result.checkoutUrl,
    };
  } catch (err) {
    if (err instanceof BookingStateError) {
      return { status: "error", message: err.message };
    }
    // eslint-disable-next-line no-console
    console.error("[completion] completeBooking failed", err);
    return {
      status: "error",
      message: "Errore inatteso. Riprova o contatta lo staff.",
    };
  }
}
