import "server-only";

import { getServiceClient, type ServiceClient } from "@/server/supabase";

import type { AppSettingsRow } from "./types";

/**
 * A short-lived per-action context. Carries the privileged DB client and
 * memoises the (singleton) app_settings row so individual actions don't
 * re-query for completion/payment windows and consent versions.
 *
 * Construct once at the start of an action; pass it down to helpers.
 */
export type ActionContext = {
  client: ServiceClient;
  settings: AppSettingsRow;
  now: Date;
};

let cachedSettings: AppSettingsRow | null = null;
let cachedSettingsAt = 0;
const SETTINGS_TTL_MS = 30_000;

async function loadSettings(client: ServiceClient): Promise<AppSettingsRow> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettingsAt < SETTINGS_TTL_MS) {
    return cachedSettings;
  }
  const { data, error } = await client
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("app_settings (id=1) missing");
  cachedSettings = data;
  cachedSettingsAt = now;
  return data;
}

export function invalidateSettingsCache() {
  cachedSettings = null;
  cachedSettingsAt = 0;
}

export async function createActionContext(): Promise<ActionContext> {
  const client = getServiceClient();
  const settings = await loadSettings(client);
  return { client, settings, now: new Date() };
}
