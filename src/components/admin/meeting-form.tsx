"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMeeting } from "@/server/actions/meetings";

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    try {
      await createMeeting({
        title: String(data.get("title")),
        description: String(data.get("description") || ""),
        bookId: (data.get("bookId") as string) || null,
        startsAt: new Date(String(data.get("startsAt"))),
        endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))) : null,
        location: (data.get("location") as string) || null,
        meetingUrl: (data.get("meetingUrl") as string) || null,
        isVirtual,
      });
      toast.success("Reunión creada");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="m-title">Título</Label>
        <Input id="m-title" name="title" required placeholder="Encuentro mensual" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="m-startsAt">Inicio</Label>
          <Input id="m-startsAt" name="startsAt" type="datetime-local" required defaultValue={dateToInput(tomorrow)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-endsAt">Fin <span className="lowercase tracking-normal text-muted-foreground/70">(opcional)</span></Label>
          <Input id="m-endsAt" name="endsAt" type="datetime-local" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="m-bookId">Libro asociado <span className="lowercase tracking-normal text-muted-foreground/70">(opcional)</span></Label>
        <select
          id="m-bookId"
          name="bookId"
          className="flex h-11 w-full rounded-lg border border-input bg-background/40 backdrop-blur px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue=""
        >
          <option value="">— Sin libro —</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isVirtual}
            onChange={(e) => setIsVirtual(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Reunión virtual
        </label>
      </div>

      {isVirtual ? (
        <div className="space-y-2">
          <Label htmlFor="m-meetingUrl">Enlace (Zoom, Meet, …)</Label>
          <Input id="m-meetingUrl" name="meetingUrl" type="url" placeholder="https://" />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="m-location">Lugar</Label>
          <Input id="m-location" name="location" placeholder="Café de la luna, Calle 123" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="m-description">Descripción <span className="lowercase tracking-normal text-muted-foreground/70">(opcional)</span></Label>
        <Textarea id="m-description" name="description" rows={3} maxLength={2000} placeholder="Qué traer, qué esperar..." />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Crear reunión
      </Button>
    </form>
  );
}
