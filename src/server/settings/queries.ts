import "server-only";

import { getServiceClient, type Tables } from "@/server/supabase";

export type AppSettingsRow = Tables<"app_settings">;

export async function getAppSettings(): Promise<AppSettingsRow> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("app_settings (id=1) missing");
  return data;
}
