"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createEventAction,
  editEventAction,
} from "@/server/events/actions";
import type {
  EventCreateInput,
  EventEditInput,
} from "@/server/events/schema";

export type EventFormInitial = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  startsAt: string;
  durationMin: number | null;
  capacity: number;
  priceCents: number;
  vatRateBps: number;
  status: "draft" | "published" | "closed" | "archived";
};

type EventFormProps =
  | { mode: "create"; initial?: undefined }
  | { mode: "edit"; initial: EventFormInitial };

function isoToLocalDateInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function defaultStartsAtLocal() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  now.setHours(20, 0, 0, 0);
  return isoToLocalDateInput(now.toISOString());
}

export function EventForm(props: EventFormProps) {
  const router = useRouter();
  const isEditLocked = props.mode === "edit" && props.initial.status !== "draft";

  const initial = props.mode === "edit"
    ? {
        title: props.initial.title,
        startsAtLocal: isoToLocalDateInput(props.initial.startsAt),
        capacity: props.initial.capacity,
        priceEuro: (props.initial.priceCents / 100).toFixed(2),
        slug: props.initial.slug,
        // preserved from existing record but not editable here
        description: props.initial.description,
        durationMin: props.initial.durationMin,
      }
    : {
        title: "",
        startsAtLocal: defaultStartsAtLocal(),
        capacity: 16,
        priceEuro: "95.00",
        slug: "",
        description: null as string | null,
        durationMin: null as number | null,
      };

  const [title, setTitle] = React.useState(initial.title);
  const [startsAtLocal, setStartsAtLocal] = React.useState(initial.startsAtLocal);
  const [capacity, setCapacity] = React.useState<number>(initial.capacity);
  const [priceEuro, setPriceEuro] = React.useState(initial.priceEuro);
  const [slug, setSlug] = React.useState(initial.slug);

  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const canSubmit =
    !isEditLocked &&
    title.trim().length > 1 &&
    startsAtLocal.length > 0 &&
    capacity > 0 &&
    Number(priceEuro) > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFieldErrors({});
    setGlobalError(null);

    if (props.mode === "create") {
      const input: EventCreateInput = {
        title: title.trim(),
        startsAt: startsAtLocal,
        capacity,
        priceEuros: priceEuro,
        slug: slug.trim() || undefined,
      };
      const result = await createEventAction(input);
      setSubmitting(false);
      if (result.status === "error") {
        setGlobalError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      toast.success("Evento creato come bozza");
      router.push(`/admin/events/${result.eventId}`);
    } else {
      const input: EventEditInput = {
        id: props.initial.id,
        title: title.trim(),
        description: initial.description ?? undefined,
        startsAt: startsAtLocal,
        durationMin: initial.durationMin ?? undefined,
        capacity,
        priceEuros: priceEuro,
        slug: slug.trim() || undefined,
      };
      const result = await editEventAction(input);
      setSubmitting(false);
      if (result.status === "error") {
        setGlobalError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      toast.success("Modifiche salvate");
      router.push(`/admin/events/${result.eventId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {isEditLocked ? (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-amber-900">
              Questo evento non è più una bozza.
            </p>
            <p className="text-xs text-amber-900/80">
              Una volta pubblicato non si può più modificare. Se devi correggere
              qualcosa, archivia questo evento e creane uno nuovo.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {globalError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {globalError}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informazioni evento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Titolo *"
            id="title"
            sm
            error={fieldErrors.title}
            input={
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Cena degustazione al tartufo bianco"
                disabled={isEditLocked}
                required
              />
            }
          />
          <Field
            label="Data e ora *"
            id="startsAt"
            sm
            error={fieldErrors.startsAt}
            input={
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAtLocal}
                onChange={(e) => setStartsAtLocal(e.target.value)}
                disabled={isEditLocked}
                required
              />
            }
          />
          <Field
            label="Capienza (posti totali) *"
            id="capacity"
            error={fieldErrors.capacity}
            input={
              <Input
                id="capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                disabled={isEditLocked}
                required
              />
            }
          />
          <Field
            label="Prezzo per persona (€, IVA inclusa) *"
            id="price"
            error={fieldErrors.priceEuros}
            input={
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                value={priceEuro}
                onChange={(e) => setPriceEuro(e.target.value)}
                disabled={isEditLocked}
                required
              />
            }
          />
          <Field
            label="Slug (opzionale)"
            id="slug"
            sm
            error={fieldErrors.slug}
            input={
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="es. cena-tartufo-bianco"
                disabled={isEditLocked}
              />
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Annulla
        </Button>
        <Button type="submit" disabled={!canSubmit || submitting}>
          <Save className="h-4 w-4" />
          {submitting
            ? "Salvataggio…"
            : props.mode === "edit"
              ? "Salva modifiche"
              : "Crea bozza"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Le bozze non sono visibili pubblicamente. Per pubblicare, apri il
        dettaglio dell&apos;evento e premi <span className="font-medium">Pubblica</span>.
      </p>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  input: React.ReactNode;
  error?: string;
  sm?: boolean;
};

function Field({ id, label, input, error, sm }: FieldProps) {
  return (
    <div className={`space-y-1.5 ${sm ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {input}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
