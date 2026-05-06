"use client";

import * as React from "react";
import { Loader2, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { updateProgress } from "@/server/actions/progress";
import { pageProgress } from "@/lib/utils";

interface ProgressFormProps {
  bookId: string;
  totalPages?: number | null;
  initialPage?: number;
}

export function ProgressForm({ bookId, totalPages, initialPage = 0 }: ProgressFormProps) {
  const [page, setPage] = React.useState(initialPage);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const pct = pageProgress(page, totalPages);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProgress({ bookId, currentPage: page, note: note || undefined });
      toast.success(`Avance guardado · ${pct}%`);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-end">
        <div className="space-y-2">
          <Label htmlFor="page">Página actual</Label>
          <Input
            id="page"
            type="number"
            min={0}
            max={totalPages ?? 20000}
            value={page}
            onChange={(e) => setPage(Math.max(0, Number(e.target.value || 0)))}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>Progreso</span>
            <span className="tabular-nums">
              {pct}%{totalPages ? ` · ${page} / ${totalPages}` : ""}
            </span>
          </div>
          <Progress value={pct} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Nota <span className="lowercase tracking-normal text-muted-foreground/70">(opcional)</span></Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="¿Cómo va la lectura?"
          maxLength={400}
          rows={2}
        />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
        Actualizar avance
      </Button>
    </form>
  );
}
