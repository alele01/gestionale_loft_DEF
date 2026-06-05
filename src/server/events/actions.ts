"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { appendAuditLog } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { requireAdmin } from "@/server/auth/require-admin";
import { getServiceClient } from "@/server/supabase";
import { romeLocalToUtcIso } from "@/lib/rome-time";

import {
  EventCreateSchema,
  EventEditSchema,
  type EventCreateInput,
  type EventEditInput,
} from "./schema";
import { ensureUniqueSlug, slugify } from "./slug";

export type EventActionResult =
  | { status: "ok"; eventId: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const first = issue.path[0];
    const key = first === undefined ? "_root" : String(first);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createEventAction(
  input: EventCreateInput
): Promise<EventActionResult> {
  const identity = await requireAdmin();
  const parsed = EventCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Dati evento non validi",
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }
  const values = parsed.data;

  const client = getServiceClient();
  const baseSlug = slugify(values.slug ?? values.title);
  const slug = await ensureUniqueSlug(client, baseSlug);

  // The form sends a timezone-less wall-clock string (Europe/Rome). Anchor
  // it to Rome so the stored UTC instant matches what the admin typed.
  const startsAtISO = romeLocalToUtcIso(values.startsAt);

  const { data, error } = await client
    .from("events")
    .insert({
      title: values.title,
      description: values.description ?? null,
      slug,
      starts_at: startsAtISO,
      duration_min: values.durationMin ?? null,
      capacity: values.capacity,
      price_cents: values.priceEuros,
      vat_rate_bps: values.vatRateBps,
      status: "draft",
      created_by: identity.adminUser.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Errore creazione evento" };
  }

  await appendAuditLog({
    entityType: AUDIT_ENTITIES.event,
    entityId: data.id,
    action: AUDIT_ACTIONS.eventCreated,
    actorType: AUDIT_ACTORS.admin,
    actorId: identity.adminUser.id,
    toState: "draft",
    metadata: { slug, capacity: values.capacity, price_cents: values.priceEuros },
  });

  revalidatePath("/admin/events");
  revalidatePath("/admin/dashboard");
  return { status: "ok", eventId: data.id };
}

export async function createEventActionAndRedirect(
  input: EventCreateInput
): Promise<EventActionResult> {
  const result = await createEventAction(input);
  if (result.status === "ok") redirect(`/admin/events/${result.eventId}`);
  return result;
}

export async function editEventAction(
  input: EventEditInput
): Promise<EventActionResult> {
  const identity = await requireAdmin();
  const parsed = EventEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Dati evento non validi",
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }
  const values = parsed.data;

  const client = getServiceClient();
  const { data: existing, error: fetchErr } = await client
    .from("events")
    .select("id, slug, title, status")
    .eq("id", values.id)
    .maybeSingle();
  if (fetchErr) return { status: "error", message: fetchErr.message };
  if (!existing) return { status: "error", message: "Evento non trovato" };

  const baseSlug = slugify(values.slug ?? existing.slug ?? values.title);
  const slug =
    baseSlug === existing.slug
      ? existing.slug
      : await ensureUniqueSlug(client, baseSlug, existing.id);

  const startsAtISO = romeLocalToUtcIso(values.startsAt);

  const { error } = await client
    .from("events")
    .update({
      title: values.title,
      description: values.description ?? null,
      slug,
      starts_at: startsAtISO,
      duration_min: values.durationMin ?? null,
      capacity: values.capacity,
      price_cents: values.priceEuros,
      vat_rate_bps: values.vatRateBps,
    })
    .eq("id", values.id);

  if (error) return { status: "error", message: error.message };

  await appendAuditLog({
    entityType: AUDIT_ENTITIES.event,
    entityId: values.id,
    action: AUDIT_ACTIONS.eventUpdated,
    actorType: AUDIT_ACTORS.admin,
    actorId: identity.adminUser.id,
    metadata: { slug },
  });

  revalidatePath(`/admin/events/${values.id}`);
  revalidatePath("/admin/events");
  revalidatePath("/admin/dashboard");
  return { status: "ok", eventId: values.id };
}

export async function publishEventAction(eventId: string): Promise<EventActionResult> {
  const identity = await requireAdmin();
  const client = getServiceClient();

  const { data: existing, error: fetchErr } = await client
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle();
  if (fetchErr) return { status: "error", message: fetchErr.message };
  if (!existing) return { status: "error", message: "Evento non trovato" };

  if (existing.status !== "draft") {
    return {
      status: "error",
      message: `Impossibile pubblicare: stato corrente '${existing.status}'`,
    };
  }

  const { error } = await client
    .from("events")
    .update({ status: "published" })
    .eq("id", eventId);
  if (error) return { status: "error", message: error.message };

  await appendAuditLog({
    entityType: AUDIT_ENTITIES.event,
    entityId: eventId,
    action: AUDIT_ACTIONS.eventPublished,
    actorType: AUDIT_ACTORS.admin,
    actorId: identity.adminUser.id,
    fromState: "draft",
    toState: "published",
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  revalidatePath("/admin/dashboard");
  return { status: "ok", eventId };
}

export async function archiveEventAction(eventId: string): Promise<EventActionResult> {
  const identity = await requireAdmin();
  const client = getServiceClient();

  const { data: existing, error: fetchErr } = await client
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle();
  if (fetchErr) return { status: "error", message: fetchErr.message };
  if (!existing) return { status: "error", message: "Evento non trovato" };

  if (existing.status === "archived") {
    return { status: "ok", eventId };
  }
  if (existing.status !== "draft") {
    return {
      status: "error",
      message:
        "Solo gli eventi in bozza possono essere archiviati. Un evento pubblicato resta tale per coerenza con le prenotazioni già raccolte.",
    };
  }

  const { error } = await client
    .from("events")
    .update({ status: "archived" })
    .eq("id", eventId);
  if (error) return { status: "error", message: error.message };

  await appendAuditLog({
    entityType: AUDIT_ENTITIES.event,
    entityId: eventId,
    action: AUDIT_ACTIONS.eventArchived,
    actorType: AUDIT_ACTORS.admin,
    actorId: identity.adminUser.id,
    fromState: existing.status,
    toState: "archived",
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  revalidatePath("/admin/dashboard");
  return { status: "ok", eventId };
}
