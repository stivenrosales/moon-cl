"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { DateTimeInput } from "@/components/ui/datetime-input";
import {
  KahootScoresForm,
  type KahootMemberOption,
  type KahootScoreValues,
} from "@/components/admin/kahoot-scores-form";
import { createKahootActivity } from "@/server/actions/kahoot";

interface MeetingOption {
  id: string;
  title: string;
}

function dateToInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewKahootActivityForm({
  members,
  meetings,
}: {
  members: KahootMemberOption[];
  meetings: MeetingOption[];
}) {
  const now = new Date();
  const [submitting, setSubmitting] = React.useState(false);
  const [playedAt, setPlayedAt] = React.useState(dateToInput(now));
  const [scoreValues, setScoreValues] = React.useState<KahootScoreValues>({});

  function handleScoreChange(userId: string, field: "points" | "correctAnswers", value: string) {
    setScoreValues((prev) => {
      const current = prev[userId] ?? { points: "", correctAnswers: "" };
      return { ...prev, [userId]: { ...current, [field]: value } };
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    try {
      const scores = Object.entries(scoreValues)
        .filter(([, v]) => v.points.trim() !== "")
        .map(([userId, v]) => ({
          userId,
          points: Number(v.points),
          correctAnswers: v.correctAnswers.trim() !== "" ? Number(v.correctAnswers) : null,
        }));

      await createKahootActivity({
        title: String(data.get("title")),
        description: String(data.get("description") || ""),
        playedAt: new Date(playedAt),
        meetingId: (data.get("meetingId") as string) || null,
        scores,
      });
      toast.success("Actividad de Kahoot creada");
      (e.target as HTMLFormElement).reset();
      setPlayedAt(dateToInput(now));
      setScoreValues({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field>
        <Label htmlFor="k-title" required>Título</Label>
        <Input id="k-title" name="title" required placeholder="Trivia de Rayuela" />
      </Field>

      <Field>
        <Label htmlFor="k-playedAt" required>Fecha</Label>
        <DateTimeInput
          id="k-playedAt"
          name="playedAt"
          required
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
        />
      </Field>

      <Field>
        <Label htmlFor="k-meetingId" optional>Reunión asociada</Label>
        <Select id="k-meetingId" name="meetingId" defaultValue="">
          <option value="">— Sin reunión —</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="k-description" optional>Descripción</Label>
        <Textarea
          id="k-description"
          name="description"
          rows={2}
          maxLength={2000}
          placeholder="Sobre qué capítulos, cuántas preguntas..."
        />
      </Field>

      <Field>
        <Label optional>Puntajes de quienes jugaron</Label>
        <KahootScoresForm
          members={members}
          values={scoreValues}
          onChange={handleScoreChange}
        />
        <FieldDescription>
          Deja el campo vacío para quien no jugó. Puedes cargar o corregir puntajes después.
        </FieldDescription>
      </Field>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Crear actividad
      </Button>
    </form>
  );
}
