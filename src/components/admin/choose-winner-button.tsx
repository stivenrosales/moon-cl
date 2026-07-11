"use client";

import * as React from "react";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chooseRoundWinner } from "@/server/actions/rounds";

interface ChooseWinnerButtonProps {
  suggestionId: string;
  bookTitle: string;
  isAlreadyWinner?: boolean;
}

export function ChooseWinnerButton({
  suggestionId,
  bookTitle,
  isAlreadyWinner,
}: ChooseWinnerButtonProps) {
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    const msg = isAlreadyWinner
      ? `¿Reconfirmar "${bookTitle}" como lectura del club? Cualquier libro en curso pasará a leído.`
      : `¿Aprobar "${bookTitle}" como lectura del club? Esto cierra la ronda y marca cualquier libro en curso como leído.`;
    if (!confirm(msg)) return;
    setPending(true);
    try {
      await chooseRoundWinner(suggestionId);
      toast.success("Lectura del club aprobada ✦");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={isAlreadyWinner ? "outline" : "gold"}
      disabled={pending}
      onClick={onClick}
      title={isAlreadyWinner ? "Reconfirmar lectura" : "Aprobar como lectura del club"}
      aria-label={isAlreadyWinner ? "Reconfirmar lectura" : "Aprobar como lectura del club"}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Crown className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {isAlreadyWinner ? "Reconfirmar" : "Aprobar lectura"}
      </span>
    </Button>
  );
}
