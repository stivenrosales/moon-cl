"use client";

import * as React from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleVote } from "@/server/actions/votes";
import { cn } from "@/lib/utils";

interface VoteButtonProps {
  suggestionId: string;
  initialVoted: boolean;
  initialCount: number;
  disabled?: boolean;
}

export function VoteButton({
  suggestionId,
  initialVoted,
  initialCount,
  disabled,
}: VoteButtonProps) {
  const [voted, setVoted] = React.useState(initialVoted);
  const [count, setCount] = React.useState(initialCount);
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    if (disabled) return;
    setLoading(true);

    // Optimistic update
    const next = !voted;
    setVoted(next);
    setCount((c) => c + (next ? 1 : -1));

    try {
      await toggleVote(suggestionId);
    } catch (err) {
      setVoted(!next);
      setCount((c) => c + (next ? -1 : 1));
      const msg = err instanceof Error ? err.message : "No se pudo registrar el voto";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={voted ? "default" : "outline"}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn("gap-2", voted && "shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.7)]")}
      aria-pressed={voted}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", voted && "fill-current")} />
      )}
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{voted ? "Quitar voto" : "Votar"}</span>
    </Button>
  );
}
