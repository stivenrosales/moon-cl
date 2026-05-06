"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRound } from "@/server/actions/rounds";

function dateToInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewRoundForm() {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    try {
      await createRound({
        title: String(data.get("title")),
        description: String(data.get("description") || ""),
        startsAt: new Date(String(data.get("startsAt"))),
        endsAt: new Date(String(data.get("endsAt"))),
      });
      toast.success("Ronda creada");
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
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required placeholder="Ronda Mayo 2026" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción <span className="lowercase tracking-normal text-muted-foreground/70">(opcional)</span></Label>
        <Textarea id="description" name="description" placeholder="¿Algún tema, género, longitud máxima?" rows={3} maxLength={800} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Apertura</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={dateToInput(now)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Cierre</Label>
          <Input id="endsAt" name="endsAt" type="datetime-local" required defaultValue={dateToInput(inAWeek)} />
        </div>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Crear ronda
      </Button>
    </form>
  );
}
