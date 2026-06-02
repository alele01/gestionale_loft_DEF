/**
 * Detect booking requests that look like duplicates within the same event.
 * Match is by normalized email OR normalized phone — never across events.
 */

export type RequestDuplicateInfo = {
  matchTypes: Array<"email" | "phone">;
  /** Other request ids in the same event that triggered the match. */
  otherIds: string[];
};

export type RequestDuplicateInput = {
  id: string;
  eventId: string;
  email: string;
  phone: string;
};

export function normalizeRequestEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strip formatting; compare digits only. Unifies optional Italian +39 prefix. */
export function normalizeRequestPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("39") && digits.length >= 11) {
    digits = digits.slice(2);
  }
  return digits;
}

export function duplicateMatchLabel(info: RequestDuplicateInfo): string {
  const hasEmail = info.matchTypes.includes("email");
  const hasPhone = info.matchTypes.includes("phone");
  if (hasEmail && hasPhone) return "Stessa email e telefono";
  if (hasEmail) return "Stessa email";
  return "Stesso telefono";
}

/**
 * Build a lookup of request id → duplicate info for a list of requests.
 * Only flags rows that share an event with at least one other matching row.
 */
export function indexRequestDuplicates(
  items: RequestDuplicateInput[]
): Map<string, RequestDuplicateInfo> {
  const result = new Map<string, RequestDuplicateInfo>();
  const byEvent = new Map<string, RequestDuplicateInput[]>();

  for (const item of items) {
    const group = byEvent.get(item.eventId) ?? [];
    group.push(item);
    byEvent.set(item.eventId, group);
  }

  for (const group of byEvent.values()) {
    if (group.length < 2) continue;

    const emailToIds = new Map<string, string[]>();
    const phoneToIds = new Map<string, string[]>();

    for (const item of group) {
      const email = normalizeRequestEmail(item.email);
      if (email) {
        const ids = emailToIds.get(email) ?? [];
        ids.push(item.id);
        emailToIds.set(email, ids);
      }

      const phone = normalizeRequestPhone(item.phone);
      if (phone.length >= 8) {
        const ids = phoneToIds.get(phone) ?? [];
        ids.push(item.id);
        phoneToIds.set(phone, ids);
      }
    }

    for (const item of group) {
      const matchTypes: Array<"email" | "phone"> = [];
      const otherIds = new Set<string>();

      const email = normalizeRequestEmail(item.email);
      const emailIds = emailToIds.get(email);
      if (emailIds && emailIds.length > 1) {
        matchTypes.push("email");
        for (const id of emailIds) {
          if (id !== item.id) otherIds.add(id);
        }
      }

      const phone = normalizeRequestPhone(item.phone);
      const phoneIds = phoneToIds.get(phone);
      if (phone.length >= 8 && phoneIds && phoneIds.length > 1) {
        matchTypes.push("phone");
        for (const id of phoneIds) {
          if (id !== item.id) otherIds.add(id);
        }
      }

      if (matchTypes.length > 0) {
        result.set(item.id, {
          matchTypes,
          otherIds: [...otherIds],
        });
      }
    }
  }

  return result;
}
