import { z } from "zod";

/**
 * Zod schemas for event create / edit. Mirrors `events` CHECK constraints
 * defined in supabase/migrations/20260520120000_init_schema.sql.
 */

export const EVENT_STATUSES = [
  "draft",
  "published",
  "closed",
  "archived",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EventCreateSchema = z.object({
  title: z.string().trim().min(2, "Titolo troppo corto").max(160),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** ISO-like local datetime string, e.g. "2026-06-12T19:30". */
  startsAt: z
    .string()
    .min(1, "Data e ora richieste")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Data non valida"),
  durationMin: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => undefined)])
    .optional(),
  capacity: z.coerce.number().int().positive("Capienza > 0").max(500),
  /** Euro as decimal string (e.g. "89.00"). Stored as price_cents. */
  priceEuros: z
    .union([z.coerce.number().positive("Prezzo > 0"), z.string().regex(/^\d+([.,]\d{1,2})?$/)])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      if (Number.isNaN(n) || n <= 0) throw new Error("Prezzo non valido");
      return Math.round(n * 100);
    }),
  vatRateBps: z
    .union([z.coerce.number().int(), z.literal("").transform(() => 2200)])
    .optional()
    .transform((v) => (v === undefined ? 2200 : v))
    .pipe(z.number().int().min(0).max(5000)),
  /** Optional slug override; otherwise derived from the title. */
  slug: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type EventCreateInput = z.input<typeof EventCreateSchema>;
export type EventCreateValues = z.output<typeof EventCreateSchema>;

export const EventEditSchema = EventCreateSchema.extend({
  id: z.string().uuid(),
});
export type EventEditInput = z.input<typeof EventEditSchema>;
export type EventEditValues = z.output<typeof EventEditSchema>;
