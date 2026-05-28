const dateFmt = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

const dateOnlyFmt = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeZone: "Europe/Rome",
});

const shortDateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Rome",
});

const eurFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatDateTime(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnlyFmt.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFmt.format(new Date(iso));
}

export function formatEuro(cents: number): string {
  return eurFmt.format(cents / 100);
}
