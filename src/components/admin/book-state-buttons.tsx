"use client";

import * as React from "react";
import { BookCheck, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setBookAsCurrent, markBookAsFinished } from "@/server/actions/admin";

export function BookStateButtons({
  bookId,
  isCurrent,
}: {
  bookId: string;
  isCurrent: boolean;
}) {
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

  if (isCurrent) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => markBookAsFinished(bookId), "Libro marcado como leído")}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookCheck className="h-3.5 w-3.5" />}
        Marcar como leído
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="gold"
      disabled={pending}
      onClick={() => run(() => setBookAsCurrent(bookId), "Ahora es el libro en curso")}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
      Marcar en curso
    </Button>
  );
}
