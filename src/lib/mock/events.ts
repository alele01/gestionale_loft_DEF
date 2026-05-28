import type { EventRecord } from "./types";

export const mockEvents: EventRecord[] = [
  {
    id: "evt-cena-tartufo",
    slug: "cena-tartufo-novembre",
    title: "Cena degustazione al tartufo bianco",
    description:
      "Menù degustazione 6 portate con tartufo bianco d'Alba, abbinamento vini selezionati. Una serata intima al Cooker Loft.",
    startsAt: "2026-06-14T20:00:00.000Z",
    durationMin: 180,
    capacity: 16,
    priceCents: 12000,
    currency: "EUR",
    vatRateBps: 2200,
    status: "published",
    createdAt: "2026-04-20T09:12:00.000Z",
  },
  {
    id: "evt-cooking-class",
    slug: "cooking-class-pasta-fresca",
    title: "Cooking class — Pasta fresca ripiena",
    description:
      "Workshop con Cooker Girl: impasto, ripieni e tecniche di chiusura. Cena finale con il piatto preparato e calice di vino.",
    startsAt: "2026-06-21T18:30:00.000Z",
    durationMin: 210,
    capacity: 12,
    priceCents: 9500,
    currency: "EUR",
    vatRateBps: 2200,
    status: "published",
    createdAt: "2026-04-25T14:35:00.000Z",
  },
  {
    id: "evt-anteprima-estate",
    slug: "anteprima-estate-2026",
    title: "Anteprima estate — bozza",
    description:
      "Evento in fase di definizione: menù estivo a base di pesce, terrazza riservata.",
    startsAt: "2026-07-12T20:00:00.000Z",
    durationMin: 180,
    capacity: 20,
    priceCents: 11000,
    currency: "EUR",
    vatRateBps: 2200,
    status: "draft",
    createdAt: "2026-05-12T11:00:00.000Z",
  },
  {
    id: "evt-aperitivo-aprile",
    slug: "aperitivo-aprile-2026",
    title: "Aperitivo di primavera (concluso)",
    description:
      "Aperitivo conviviale con selezione di vini biologici e finger food. Evento già passato — visibile per lo storico.",
    startsAt: "2026-04-18T18:30:00.000Z",
    durationMin: 150,
    capacity: 24,
    priceCents: 4500,
    currency: "EUR",
    vatRateBps: 2200,
    status: "closed",
    createdAt: "2026-03-10T10:00:00.000Z",
  },
];

export function getEventById(id: string): EventRecord | undefined {
  return mockEvents.find((e) => e.id === id);
}

export function getEventBySlug(slug: string): EventRecord | undefined {
  return mockEvents.find((e) => e.slug === slug);
}
