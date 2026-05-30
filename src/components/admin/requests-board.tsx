"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronsUpDown, Mail, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UnifiedStatusBadge } from "@/components/shared/unified-status-badge";
import { formatDateTime } from "@/lib/format";
import {
  REQUEST_STATUS_HINT,
  REQUEST_STATUS_ORDER,
  type RequestListItem,
} from "@/lib/request-list";
import { unifiedStatusLabel, type UnifiedStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

type StatusFilter = UnifiedStatus | "all";
type EventFilter = string | "all";

type RequestsBoardProps = {
  items: RequestListItem[];
  /**
   * When provided, renders an additional "filter by event" dropdown. Omit on
   * the per-event page (where the event is already fixed).
   */
  events?: { id: string; title: string }[];
  /**
   * Whether to show the event title on each row. Defaults to true; set false
   * on the per-event page where it would be redundant.
   */
  showEvent?: boolean;
  /** Message shown when there is no data at all (before any filtering). */
  emptyLabel?: string;
};

export function RequestsBoard({
  items,
  events,
  showEvent = true,
  emptyLabel = "Nessuna prenotazione ancora.",
}: RequestsBoardProps) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [eventFilter, setEventFilter] = React.useState<EventFilter>("all");

  // Narrow by event first, so the status pill counts reflect the event subset.
  const eventScoped = React.useMemo(
    () =>
      eventFilter === "all"
        ? items
        : items.filter((it) => it.eventId === eventFilter),
    [items, eventFilter]
  );

  const countByStatus = React.useMemo(() => {
    const acc = {} as Record<UnifiedStatus, number>;
    for (const it of eventScoped) {
      acc[it.unifiedStatus] = (acc[it.unifiedStatus] ?? 0) + 1;
    }
    return acc;
  }, [eventScoped]);

  // Only surface status pills that actually have rows in the current scope.
  const presentStatuses = REQUEST_STATUS_ORDER.filter(
    (s) => (countByStatus[s] ?? 0) > 0
  );

  // If the active status filter no longer matches anything (e.g. after
  // switching event), fall back to "all" so the user never sees a dead view.
  React.useEffect(() => {
    if (statusFilter !== "all" && (countByStatus[statusFilter] ?? 0) === 0) {
      setStatusFilter("all");
    }
  }, [statusFilter, countByStatus]);

  const visibleStatuses =
    statusFilter === "all" ? presentStatuses : [statusFilter];

  const selectedEventTitle =
    eventFilter === "all"
      ? "Tutti gli eventi"
      : (events?.find((e) => e.id === eventFilter)?.title ?? "Evento");

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          label="Tutti"
          count={eventScoped.length}
        />
        {presentStatuses.map((s) => (
          <FilterPill
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            label={unifiedStatusLabel[s]}
            count={countByStatus[s] ?? 0}
          />
        ))}

        {events && events.length > 0 ? (
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="max-w-[12rem] truncate">
                    {selectedEventTitle}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
                <DropdownMenuItem onSelect={() => setEventFilter("all")}>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      eventFilter === "all" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Tutti gli eventi
                </DropdownMenuItem>
                {events.map((e) => (
                  <DropdownMenuItem
                    key={e.id}
                    onSelect={() => setEventFilter(e.id)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        eventFilter === e.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{e.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {visibleStatuses.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessuna prenotazione per i filtri selezionati.
          </CardContent>
        </Card>
      ) : (
        visibleStatuses.map((status) => {
          const rows = eventScoped.filter((it) => it.unifiedStatus === status);
          if (rows.length === 0) return null;
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{unifiedStatusLabel[status]}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                    {rows.length}
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {REQUEST_STATUS_HINT[status]}
                </p>
              </CardHeader>
              <CardContent className="divide-y">
                {rows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/admin/prenotazioni/${row.id}`}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">
                        {row.firstName} {row.lastName}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          <Users className="mr-1 inline h-3 w-3" />
                          {row.people}
                        </span>
                      </p>
                      {showEvent ? (
                        <p className="truncate text-xs text-muted-foreground">
                          <CalendarDays className="mr-1 inline h-3 w-3" />
                          {row.eventTitle} ·{" "}
                          {formatDateTime(row.eventStartsAt)}
                        </p>
                      ) : null}
                      <p className="truncate text-[11px] text-muted-foreground">
                        <Mail className="mr-1 inline h-3 w-3" />
                        {row.email} · {formatDateTime(row.submittedAt)}
                      </p>
                    </div>
                    <UnifiedStatusBadge status={row.unifiedStatus} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </Button>
  );
}
