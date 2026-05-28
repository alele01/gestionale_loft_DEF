"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/auth/require-admin";
import { getServiceClient } from "@/server/supabase";
import { invalidateSettingsCache } from "@/modules/booking-state/context";

const SettingsSchema = z.object({
  accountantEmail: z.string().trim().email("Email commercialista non valida"),
  reviewUrl: z
    .string()
    .trim()
    .url("URL non valido")
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reviewEmailEnabled: z.coerce.boolean().or(z.string().transform((v) => v === "on")),
  requesterReceiptEmailEnabled: z
    .coerce.boolean()
    .or(z.string().transform((v) => v === "on")),
  adminNewRequestEmailEnabled: z
    .coerce.boolean()
    .or(z.string().transform((v) => v === "on")),
  termsVersion: z.string().trim().min(1).max(80),
  privacyVersion: z.string().trim().min(1).max(80),
  healthConsentVersion: z.string().trim().min(1).max(80),
  imageUseConsentVersion: z.string().trim().min(1).max(80),
  clauses1341_1342Version: z.string().trim().min(1).max(80),
});

export type SettingsState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "ok" };

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requireAdmin();

  const parsed = SettingsSchema.safeParse({
    accountantEmail: formData.get("accountantEmail"),
    reviewUrl: formData.get("reviewUrl"),
    reviewEmailEnabled: formData.get("reviewEmailEnabled") === "on",
    requesterReceiptEmailEnabled:
      formData.get("requesterReceiptEmailEnabled") === "on",
    adminNewRequestEmailEnabled:
      formData.get("adminNewRequestEmailEnabled") === "on",
    termsVersion: formData.get("termsVersion"),
    privacyVersion: formData.get("privacyVersion"),
    healthConsentVersion: formData.get("healthConsentVersion"),
    imageUseConsentVersion: formData.get("imageUseConsentVersion"),
    clauses1341_1342Version: formData.get("clauses1341_1342Version"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_root");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Dati non validi", fieldErrors };
  }
  const v = parsed.data;

  const client = getServiceClient();
  const { error } = await client
    .from("app_settings")
    .update({
      accountant_email: v.accountantEmail,
      review_url: v.reviewUrl ?? null,
      review_email_enabled: Boolean(v.reviewEmailEnabled),
      requester_receipt_email_enabled: Boolean(v.requesterReceiptEmailEnabled),
      admin_new_request_email_enabled: Boolean(v.adminNewRequestEmailEnabled),
      terms_version: v.termsVersion,
      privacy_version: v.privacyVersion,
      health_consent_version: v.healthConsentVersion,
      image_use_consent_version: v.imageUseConsentVersion,
      clauses_1341_1342_version: v.clauses1341_1342Version,
    })
    .eq("id", 1);

  if (error) {
    return { status: "error", message: error.message };
  }

  invalidateSettingsCache();
  revalidatePath("/admin/settings");
  return { status: "ok" };
}
