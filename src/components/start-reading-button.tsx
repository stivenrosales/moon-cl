"use client";

// Botón mínimo de una sola acción — mismo patrón que follow-button.tsx: un
// solo componente cliente, sin estado global, que envuelve una server
// action. Usado por la fila de invitación del libro del club en /leer
// (ver club-reading-row.ts) cuando el usuario todavía no tiene UserBook
// para ese libro: acá SÍ hace falta interactividad real (no basta un Link)
// porque "Lo voy a leer" debe crear el UserBook en el momento, igual que en
// la card héroe de /hoy.

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startReading } from "@/server/actions/shelves";

export function StartReadingButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      await startReading(bookId);
      toast.success("Ya está en tu estantería — a leer ✦");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" onClick={onClick} disabled={pending}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <BookOpen className="h-3.5 w-3.5" />
      )}
      Lo voy a leer
    </Button>
  );
}
