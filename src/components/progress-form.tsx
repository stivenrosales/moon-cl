"use client";

import * as React from "react";
import { Loader2, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { updateProgress } from "@/server/actions/progress";
import { pageProgress } from "@/lib/utils";

interface ProgressFormProps {
  bookId: string;
  totalPages?: number | null;
  initialPage?: number;
  initialChapter?: number | null;
}

export function ProgressForm({
  bookId,
  totalPages,
  initialPage = 0,
  initialChapter,
}: ProgressFormProps) {
  const [page, setPage] = React.useState(initialPage);
  const [chapter, setChapter] = React.useState<string>(
    initialChapter ? String(initialChapter) : "",
  );
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const pct = pageProgress(page, totalPages);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProgress({
        bookId,
        currentPage: page,
        chapter: chapter ? Number(chapter) : null,
        note: note || undefined,
      });
      toast.success(`Avance guardado · ${pct}%`);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_140px_1fr] gap-4 items-end">
        <Field>
          <Label htmlFor="page" required>Página actual</Label>
          <Input
            id="page"
            type="number"
            inputMode="numeric"
            min={0}
            max={totalPages ?? 20000}
            value={page}
            onChange={(e) => setPage(Math.max(0, Number(e.target.value || 0)))}
          />
        </Field>
        <Field>
          <Label htmlFor="chapter" optional>Capítulo actual</Label>
          <Input
            id="chapter"
            type="number"
            inputMode="numeric"
            min={1}
            max={2000}
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Cap."
          />
        </Field>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>Progreso</span>
            <span className="tabular-nums text-foreground">
              {pct}%{totalPages ? ` · ${page} / ${totalPages}` : ""}
            </span>
          </div>
          <Progress value={pct} />
        </div>
      </div>

      <Field>
        <Label htmlFor="note" optional>Nota</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="¿Cómo va la lectura?"
          maxLength={400}
          rows={2}
        />
      </Field>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
        Actualizar avance
      </Button>
    </form>
  );
}
