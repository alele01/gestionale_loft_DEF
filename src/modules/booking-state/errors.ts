/**
 * Domain errors raised by the booking state machine. Callers (server
 * actions, route handlers) translate these into UI messages.
 *
 * We intentionally do NOT leak Postgres error strings to the UI; instead
 * we map them into one of the typed errors below.
 */

export class BookingStateError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "BookingStateError";
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends BookingStateError {
  constructor(what: string) {
    super("not_found", `${what} non trovato`);
  }
}

export class InvalidTransitionError extends BookingStateError {
  constructor(from: string, to: string, reason?: string) {
    super(
      "invalid_transition",
      `Transizione non valida ${from} → ${to}${reason ? `: ${reason}` : ""}`,
      { from, to, reason }
    );
  }
}

export class CapacityExceededError extends BookingStateError {
  constructor(requested: number, available: number) {
    super(
      "capacity_exceeded",
      `Posti richiesti: ${requested}, disponibili: ${available}.`,
      { requested, available }
    );
  }
}

export class ValidationError extends BookingStateError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("validation_error", message, details);
  }
}

export class ConsentMissingError extends BookingStateError {
  constructor() {
    super(
      "consent_missing",
      "Devi accettare tutte le condizioni richieste per inviare la richiesta."
    );
  }
}

export class TokenInvalidError extends BookingStateError {
  constructor() {
    super("token_invalid", "Il link non è valido o è scaduto.");
  }
}
