export type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "cancelled"
  | "expired";

export type BookingStatus =
  | "awaiting_completion"
  | "awaiting_payment"
  | "paid"
  | "expired"
  | "void";

export type BookingOrigin = "direct" | "waitlist";

export type EventStatus = "draft" | "published" | "closed" | "archived";

export type FiscalKind = "private" | "company";

export type ImageUseChoice = "accept" | "decline";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin";
};

export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: string; // ISO
  durationMin: number;
  capacity: number;
  priceCents: number;
  currency: "EUR";
  vatRateBps: number;
  status: EventStatus;
  createdAt: string;
};

export type ConsentTriplet = {
  accepted: boolean;
  acceptedAt: string;
  version: string;
};

export type RequestConsents = {
  terms: ConsentTriplet;
  privacy: ConsentTriplet;
  health: ConsentTriplet;
  ipAddress: string;
  userAgent: string;
  submittedAt: string;
};

export type CompletionConsentEntry = {
  value: boolean;
  acceptedAt: string;
  version: string;
};

export type BookingConsents = {
  submittedAt: string;
  ipAddress: string;
  userAgent: string;
  terms: CompletionConsentEntry;
  clauses1341_1342: CompletionConsentEntry;
  privacy: CompletionConsentEntry;
  health: CompletionConsentEntry;
  imageUse: {
    value: ImageUseChoice;
    acceptedAt: string;
    version: string;
  };
};

export type BookingRequest = {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  people: number;
  dietaryNotes: string | null;
  specialOccasion: string | null;
  notes: string | null;
  status: RequestStatus;
  source: "embed" | "admin";
  submittedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  decisionShareWithRequester: boolean;
  consents: RequestConsents;
  bookingId: string | null;
};

export type FiscalProfile = {
  kind: FiscalKind;
  legalName: string;
  taxCode: string | null;
  vatNumber: string | null;
  address: {
    street: string;
    city: string;
    zip: string;
    province: string | null;
    country: string;
  };
  sdiCode: string | null;
  pecEmail: string | null;
  invoiceNote: string | null;
};

export type Booking = {
  id: string;
  requestId: string;
  eventId: string;
  status: BookingStatus;
  origin: BookingOrigin;
  revision: number;
  people: number;
  amountCents: number;
  currency: "EUR";
  completionToken: string; // mocked plaintext - for navigability only
  completionTokenIssuedAt: string;
  completionTokenUsedAt: string | null;
  completionDeadlineAt: string;
  paymentDeadlineAt: string | null;
  dietaryNotes: string | null;
  specialOccasion: string | null;
  consents: BookingConsents | null;
  fiscalProfile: FiscalProfile | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  amountPaidCents: number | null;
  paidAt: string | null;
  cancelledAfterPaymentAt: string | null;
  cancelledAfterPaymentBy: string | null;
  cancelledAfterPaymentReason: string | null;
  reviewEmailSentAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  entityType: "booking_request" | "booking" | "event" | "xml_export";
  entityId: string;
  fromState: string | null;
  toState: string | null;
  action: string;
  actorType: "admin" | "representative" | "system" | "webhook" | "cron";
  actorId: string | null;
  actorLabel: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type XmlExportRecord = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "generating" | "generated" | "emailed" | "failed";
  recipientEmail: string;
  bookingsCount: number;
  totalAmountCents: number;
  generatedAt: string | null;
  emailedAt: string | null;
  createdBy: string | null;
};

export type AppSettings = {
  accountantEmail: string;
  reviewUrl: string | null;
  reviewEmailEnabled: boolean;
  xmlExportCronEnabled: boolean;
  completionWindowHours: number;
  paymentWindowHours: number;
  termsVersion: string;
  privacyVersion: string;
  healthConsentVersion: string;
  imageUseConsentVersion: string;
  clauses1341_1342Version: string;
};
