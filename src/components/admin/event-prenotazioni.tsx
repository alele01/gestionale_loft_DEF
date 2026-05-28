"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrenotazioniTable } from "@/components/admin/prenotazioni-table";
import {
  unifiedStatusLabel,
  usePrenotazioniByEvent,
  VISIBLE_STATUSES,
  type UnifiedStatus,
} from "@/lib/mock/store";

type FilterValue = "all" | UnifiedStatus;

const TABS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Tutte" },
  ...VISIBLE_STATUSES.map((s) => ({
    value: s as FilterValue,
    label: unifiedStatusLabel[s],
  })),
];

export function EventPrenotazioniSection({ eventId }: { eventId: string }) {
  const all = usePrenotazioniByEvent(eventId);

  const filtered = (v: FilterValue) =>
    v === "all" ? all : all.filter((p) => p.unifiedStatus === v);

  const counts = (v: FilterValue) => filtered(v).length;

  return (
    <Tabs defaultValue="all">
      <TabsList className="flex h-auto flex-wrap gap-1">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
              {counts(t.value)}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          <PrenotazioniTable prenotazioni={filtered(t.value)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
