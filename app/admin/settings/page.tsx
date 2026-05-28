import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAppSettings } from "@/server/settings/queries";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getAppSettings();
  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Email del commercialista, recensioni post-evento, versioni dei documenti legali."
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Impostazioni" },
        ]}
      />
      <SettingsForm
        initial={{
          accountantEmail: settings.accountant_email,
          reviewUrl: settings.review_url,
          reviewEmailEnabled: settings.review_email_enabled,
          requesterReceiptEmailEnabled: settings.requester_receipt_email_enabled,
          adminNewRequestEmailEnabled: settings.admin_new_request_email_enabled,
          termsVersion: settings.terms_version,
          privacyVersion: settings.privacy_version,
          healthConsentVersion: settings.health_consent_version,
          imageUseConsentVersion: settings.image_use_consent_version,
          clauses1341_1342Version: settings.clauses_1341_1342_version,
          completionWindowHours: settings.completion_window_hours,
          paymentWindowHours: settings.payment_window_hours,
        }}
      />
    </>
  );
}
