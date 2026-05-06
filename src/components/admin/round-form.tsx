"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { createRound } from "@/server/actions/rounds";

function dateToInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewRoundForm() {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [submitting, setSubmitting] = React.useState(false);
  const [startsAt, setStartsAt] = React.useState(dateToInput(now));
  const [endsAt, setEndsAt] = React.useState(dateToInput(inAWeek));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    try {
      await createRound({
        title: String(data.get("title")),
        description: String(data.get("description") || ""),
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      });
      toast.success("Ronda creada");
      (e.target as HTMLFormElement).reset();
      setStartsAt(dateToInput(now));
      setEndsAt(dateToInput(inAWeek));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field>
        <Label htmlFor="title" required>Título</Label>
        <Input id="title" name="title" required placeholder="Ronda Mayo 2026" />
      </Field>

      <Field>
        <Label htmlFor="description" optional>Descripción</Label>
        <Textarea id="description" name="description" placeholder="¿Algún tema, género, longitud máxima?" rows={3} maxLength={800} />
        <FieldDescription>El club lo verá al sugerir libros.</FieldDescription>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="startsAt" required>Apertura</Label>
          <DateTimeInput
            id="startsAt"
            name="startsAt"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="endsAt" required>Cierre</Label>
          <DateTimeInput
            id="endsAt"
            name="endsAt"
            required
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Crear ronda
      </Button>
    </form>
  );
}
