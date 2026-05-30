"use server";

import { getServerSupabase } from "@/server/supabase";

/**
 * Server actions backing the admin two-factor (TOTP) flow. Everything runs
 * through the cookie-bound SSR client so the elevated (aal2) session is
 * persisted in the auth cookies after a successful verification.
 *
 * TOTP MFA is managed entirely by Supabase Auth (auth.mfa_factors) — there
 * is no custom secret storage on our side.
 */

export type StartEnrollmentResult =
  | { status: "ok"; factorId: string; qrCode: string; secret: string }
  | { status: "error"; message: string };

/**
 * Begin TOTP enrollment: returns a QR code (SVG data URL) + the textual
 * secret for manual entry. Any leftover *unverified* TOTP factors are
 * cleaned up first so repeated visits to the setup page don't pile up
 * dangling factors (and to avoid friendlyName collisions).
 */
export async function startTotpEnrollmentAction(): Promise<StartEnrollmentResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Sessione scaduta, accedi di nuovo." };
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Cooker Loft Admin ${Date.now()}`,
  });
  if (error || !data) {
    return {
      status: "error",
      message: error?.message ?? "Impossibile avviare la configurazione 2FA.",
    };
  }

  return {
    status: "ok",
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export type VerifyResult = { status: "ok" } | { status: "error"; message: string };

/**
 * Confirm a freshly enrolled TOTP factor. On success the factor becomes
 * active and the session is elevated to aal2.
 */
export async function verifyTotpEnrollmentAction(
  factorId: string,
  code: string
): Promise<VerifyResult> {
  const cleanCode = code.replace(/\s+/gu, "");
  if (!/^\d{6}$/u.test(cleanCode)) {
    return { status: "error", message: "Inserisci il codice a 6 cifre." };
  }
  const supabase = await getServerSupabase();
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return {
      status: "error",
      message: challengeError?.message ?? "Errore durante la verifica.",
    };
  }
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: cleanCode,
  });
  if (verifyError) {
    return { status: "error", message: "Codice non valido. Riprova." };
  }
  return { status: "ok" };
}

/**
 * Verify the TOTP code at login time (factor already enrolled). Elevates
 * the current session to aal2 on success.
 */
export async function verifyTotpChallengeAction(
  code: string
): Promise<VerifyResult> {
  const cleanCode = code.replace(/\s+/gu, "");
  if (!/^\d{6}$/u.test(cleanCode)) {
    return { status: "error", message: "Inserisci il codice a 6 cifre." };
  }
  const supabase = await getServerSupabase();
  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError) {
    return { status: "error", message: "Errore nel recupero del fattore 2FA." };
  }
  const totp = factors?.totp?.[0];
  if (!totp) {
    return { status: "error", message: "Nessun fattore 2FA configurato." };
  }
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challengeError || !challenge) {
    return {
      status: "error",
      message: challengeError?.message ?? "Errore durante la verifica.",
    };
  }
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code: cleanCode,
  });
  if (verifyError) {
    return { status: "error", message: "Codice non valido. Riprova." };
  }
  return { status: "ok" };
}
