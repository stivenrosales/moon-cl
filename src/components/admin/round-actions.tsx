"use client";

import * as React from "react";
import { Loader2, Lock, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closeRound, deleteRound, openRound } from "@/server/actions/rounds";
import type { RoundStatus } from "@prisma/client";

export function RoundActions({ id, status }: { id: string; status: RoundStatus }) {
  const [pending, setPending] = React.useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setPending(true);
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === "SCHEDULED" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => openRound(id), "Ronda abierta")}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          Abrir
        </Button>
      ) : null}
      {status === "OPEN" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => closeRound(id), "Ronda cerrada y ganador elegido")}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Cerrar y elegir ganador
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => {
          if (!confirm("¿Eliminar la ronda y todas sus sugerencias?")) return;
          run(() => deleteRound(id), "Ronda eliminada");
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Borrar
      </Button>
    </div>
  );
}
