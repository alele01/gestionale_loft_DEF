import type { AppSettings } from "./types";

export const mockAppSettings: AppSettings = {
  accountantEmail: "studio.commercialista@example.it",
  reviewUrl: "https://g.page/r/cookerloft/review",
  reviewEmailEnabled: true,
  xmlExportCronEnabled: true,
  completionWindowHours: 72,
  paymentWindowHours: 24,
  termsVersion: "terms@2026-05",
  privacyVersion: "privacy@2026-05",
  healthConsentVersion: "health-consent@2026-05",
  imageUseConsentVersion: "image-use@2026-05",
  clauses1341_1342Version: "clauses-1341-1342@2026-05",
};

export const APP_BASE_URL = "https://app.cookerloft.example";
