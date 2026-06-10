import type { RequestDuplicateInput } from "./request-duplicates";
import {
  normalizeRequestEmail,
  normalizeRequestPhone,
} from "./request-duplicates";

export type CrossEventRelatedInfo = {
  matchTypes: Array<"email" | "phone">;
  /** Related request ids on other events (excludes same-event siblings). */
  otherIds: string[];
  /** Distinct other event ids among related requests. */
  otherEventIds: string[];
};

/**
 * For each request, find others that share email or phone on a *different*
 * event. Complements {@link indexRequestDuplicates} which only matches
 * within the same event.
 */
export function indexCrossEventRelatedRequests(
  items: RequestDuplicateInput[]
): Map<string, CrossEventRelatedInfo> {
  const result = new Map<string, CrossEventRelatedInfo>();
  if (items.length < 2) return result;

  const emailToEntries = new Map<
    string,
    Array<{ id: string; eventId: string }>
  >();
  const phoneToEntries = new Map<
    string,
    Array<{ id: string; eventId: string }>
  >();

  for (const item of items) {
    const email = normalizeRequestEmail(item.email);
    if (email) {
      const entries = emailToEntries.get(email) ?? [];
      entries.push({ id: item.id, eventId: item.eventId });
      emailToEntries.set(email, entries);
    }

    const phone = normalizeRequestPhone(item.phone);
    if (phone.length >= 8) {
      const entries = phoneToEntries.get(phone) ?? [];
      entries.push({ id: item.id, eventId: item.eventId });
      phoneToEntries.set(phone, entries);
    }
  }

  for (const item of items) {
    const matchTypes: Array<"email" | "phone"> = [];
    const otherIds = new Set<string>();
    const otherEventIds = new Set<string>();

    const email = normalizeRequestEmail(item.email);
    const emailEntries = emailToEntries.get(email);
    if (emailEntries && emailEntries.length > 1) {
      matchTypes.push("email");
      for (const entry of emailEntries) {
        if (entry.id === item.id) continue;
        if (entry.eventId === item.eventId) continue;
        otherIds.add(entry.id);
        otherEventIds.add(entry.eventId);
      }
    }

    const phone = normalizeRequestPhone(item.phone);
    const phoneEntries = phoneToEntries.get(phone);
    if (phone.length >= 8 && phoneEntries && phoneEntries.length > 1) {
      if (!matchTypes.includes("phone")) matchTypes.push("phone");
      for (const entry of phoneEntries) {
        if (entry.id === item.id) continue;
        if (entry.eventId === item.eventId) continue;
        otherIds.add(entry.id);
        otherEventIds.add(entry.eventId);
      }
    }

    if (matchTypes.length > 0 && otherIds.size > 0) {
      result.set(item.id, {
        matchTypes,
        otherIds: [...otherIds],
        otherEventIds: [...otherEventIds],
      });
    }
  }

  return result;
}
