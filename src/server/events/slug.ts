import "server-only";

import type { ServiceClient } from "../supabase";

/**
 * Convert a free-form title into a URL-safe slug. Strips diacritics,
 * lowercases, collapses non-alphanumerics into single dashes, trims
 * leading/trailing dashes, and caps the length.
 */
export function slugify(input: string, maxLen = 80): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return normalized || "evento";
}

/**
 * Ensure a unique slug by appending `-2`, `-3`, … if needed. `excludeId`
 * lets edit flows keep their existing slug without colliding with itself.
 */
export async function ensureUniqueSlug(
  client: ServiceClient,
  base: string,
  excludeId?: string
): Promise<string> {
  const candidates = [base, ...Array.from({ length: 50 }, (_, i) => `${base}-${i + 2}`)];

  for (const candidate of candidates) {
    const query = client.from("events").select("id").eq("slug", candidate).limit(1);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
    if (excludeId && data[0].id === excludeId) return candidate;
  }

  // Pathological fallback: append a short timestamp suffix.
  return `${base}-${Date.now().toString(36)}`;
}
