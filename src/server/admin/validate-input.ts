/**
 * Runtime validation for admin server actions.
 *
 * Server actions are tightly typed at the call site (Next.js generates
 * the client wrapper from the TS signature), but a determined caller
 * can hand-craft the multipart POST that backs a server action and
 * submit any payload they want. Even though every admin action is
 * gated by `requireAdmin()`, defence in depth means the action body
 * itself should never assume that `input.bookingId` is a real UUID,
 * that `reason` is a sane length, etc.
 *
 * This module re-parses the action input with a strict zod schema
 * before any DB write. On failure it throws `AdminInputError` so the
 * existing `asError` helpers in each actions file can map the failure
 * to the standard `{ status: "error", code: "ADMIN_INPUT_INVALID" }`
 * shape and prevent the malformed payload from reaching the state
 * machine.
 */

import { z } from "zod";

export class AdminInputError extends Error {
  readonly code = "ADMIN_INPUT_INVALID";
  readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = "AdminInputError";
    this.issues = issues;
  }
}

/**
 * Parse the action input against the given schema. On failure throws
 * `AdminInputError`, which the caller's `asError` handler should map
 * to a user-facing message.
 */
export function parseAdminInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "input";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new AdminInputError(`Payload non valido: ${summary}`, [
      ...result.error.issues,
    ]);
  }
  return result.data;
}

/**
 * Shared building blocks for admin action schemas.
 *
 * - `uuid` keeps `bookingId` / `requestId` / `eventId` to the actual
 *   Postgres UUID shape (no string longer than 36 chars reaches the DB).
 * - `optionalReason` caps the free-text "reason" / "notes" fields at
 *   2000 chars to match the column CHECK in init_schema.sql and to
 *   bound JSON payloads in audit_log.
 * - `nullableTrimmedString` lets the client pass either `null` (cleared
 *   field) or a trimmed string up to the given length.
 */
export const adminSchemas = {
  uuid: z.string().uuid(),
  optionalReason: z
    .string()
    .max(2000, "Massimo 2000 caratteri")
    .trim()
    .optional()
    .nullable(),
  nullableTrimmedString: (max: number) =>
    z.string().trim().max(max).optional().nullable(),
};
