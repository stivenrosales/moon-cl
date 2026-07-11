"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { createMeeting } from "@/server/actions/meetings";
import { MEETING_TYPE_OPTIONS } from "@/lib/meeting-types";

interface BookOption {
  id: string;
  title: string;
}

function dateToInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewMeetingForm({ books }: { books: BookOption[] }) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [isVirtual, setIsVirtual] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [startsAt, setStartsAt] = React.useState(dateToInput(tomorrow));
  const [endsAt, setEndsAt] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    try {
      await createMeeting({
        title: String(data.get("title")),
        description: String(data.get("description") || ""),
        bookId: (data.get("bookId") as string) || null,
        type: (data.get("type") as string) || "REUNION",
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        location: (data.get("location") as string) || null,
        meetingUrl: (data.get("meetingUrl") as string) || null,
        isVirtual,
      });
      toast.success("Reunión creada");
      (e.target as HTMLFormElement).reset();
      setStartsAt(dateToInput(tomorrow));
      setEndsAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field>
        <Label htmlFor="m-title" required>Título</Label>
        <Input id="m-title" name="title" required placeholder="Encuentro mensual" />
      </Field>

      <Field>
        <Label htmlFor="m-type" required>Tipo</Label>
        <Select id="m-type" name="type" defaultValue="REUNION">
          {MEETING_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="m-startsAt" required>Inicio</Label>
          <DateTimeInput
            id="m-startsAt"
            name="startsAt"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="m-endsAt" optional>Fin</Label>
          <DateTimeInput
            id="m-endsAt"
            name="endsAt"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>
      </div>

      <Field>
        <Label htmlFor="m-bookId" optional>Libro asociado</Label>
        <Select id="m-bookId" name="bookId" defaultValue="">
          <option value="">— Sin libro —</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </Select>
      </Field>

      <Checkbox
        checked={isVirtual}
        onChange={(e) => setIsVirtual(e.currentTarget.checked)}
        label="Reunión virtual"
        description="Si se desactiva, pediremos una dirección física en lugar del enlace."
      />

      {isVirtual ? (
        <Field>
          <Label htmlFor="m-meetingUrl" required>Enlace</Label>
          <Input id="m-meetingUrl" name="meetingUrl" type="url" placeholder="https://meet.google.com/..." required={isVirtual} />
          <FieldDescription>Zoom, Google Meet, Jitsi… cualquier link que abra directo.</FieldDescription>
        </Field>
      ) : (
        <Field>
          <Label htmlFor="m-location" required>Lugar</Label>
          <Input id="m-location" name="location" placeholder="Café de la luna, Calle 123" required={!isVirtual} />
        </Field>
      )}

      <Field>
        <Label htmlFor="m-description" optional>Descripción</Label>
        <Textarea id="m-description" name="description" rows={3} maxLength={2000} placeholder="Qué traer, qué esperar, hasta qué capítulo..." />
      </Field>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Crear reunión
      </Button>
    </form>
  );
}
