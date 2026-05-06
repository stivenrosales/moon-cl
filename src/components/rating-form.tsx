"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarRating } from "@/components/star-rating";
import { upsertRating } from "@/server/actions/ratings";

interface RatingFormProps {
  bookId: string;
  initialStars?: number;
  initialReview?: string | null;
}

export function RatingForm({ bookId, initialStars = 0, initialReview = "" }: RatingFormProps) {
  const [stars, setStars] = React.useState(initialStars);
  const [review, setReview] = React.useState(initialReview ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) {
      toast.error("Elige al menos una estrella");
      return;
    }
    setSubmitting(true);
    try {
      await upsertRating({ bookId, stars, review: review || undefined });
      toast.success("Valoración guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <StarRating value={stars} onChange={setStars} size={28} />
        <span className="text-sm text-muted-foreground tabular-nums">
          {stars > 0 ? `${stars}/5` : "Sin valorar"}
        </span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="review">Tu reseña <span className="lowercase tracking-normal text-muted-foreground/70">(opcional)</span></Label>
        <Textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="¿Qué te dejó este libro?"
          maxLength={4000}
          rows={4}
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Guardar valoración
      </Button>
    </form>
  );
}
