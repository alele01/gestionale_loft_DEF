import "server-only";

import { getServiceClient, type ServiceClient } from "../supabase";
import type {
  AuditAction,
  AuditActor,
  AuditEntity,
} from "../audit-actions";

export type AuditLogInput = {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  actorType: AuditActor;
  actorId?: string | null;
  fromState?: string | null;
  toState?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append a row to `audit_log`. Always uses the service-role client because
 * authenticated/anon roles have NO insert policy on audit_log.
 *
 * Soft-fail policy (see docs/SECURITY.md §7):
 *  - Audit insert failures are LOGGED to the console but DO NOT throw,
 *    because a missing audit entry must never roll back the underlying
 *    business transition. The state machine treats audit as best-effort.
 */
export async function appendAuditLog(input: AuditLogInput): Promise<void> {
  const client = getServiceClient();
  await insertAuditRow(client, input);
}

/**
 * Same as appendAuditLog but reuses a caller-provided client (lets the
 * caller batch multiple writes against the same service client).
 */
export async function appendAuditLogWithClient(
  client: ServiceClient,
  input: AuditLogInput
): Promise<void> {
  await insertAuditRow(client, input);
}

async function insertAuditRow(
  client: ServiceClient,
  input: AuditLogInput
): Promise<void> {
  const { error } = await client.from("audit_log").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    reason: input.reason ?? null,
    metadata: (input.metadata ?? {}) as never,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to insert audit row", {
      input,
      error,
    });
  }
}
