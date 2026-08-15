"use client";

import * as React from "react";
import { Check, Loader2, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { createQuote } from "@/server/actions/quotes";

export interface ShareableBook {
  id: string;
  title: string;
}

interface ShareQuoteDialogProps {
  books: ShareableBook[];
  triggerLabel?: string;
}

export function ShareQuoteDialog({ books, triggerLabel = "Compartir una frase" }: ShareQuoteDialogProps) {
  const [open, setOpen] = React.useState(false);
  // Contador de aperturas: es la key del formulario, así que abrir el
  // diálogo lo REMONTA y su estado vuelve a derivarse de `books`. Antes
  // bookId/content/page/chapter vivían acá, en un componente que nunca se
  // desmonta, y `reset()` solo limpiaba content/page/chapter (ni siquiera
  // bookId) y encima solo se llamaba tras un submit exitoso — el botón
  // Cancelar no lo tocaba. Escribías una frase, cancelabas, reabrías
  // (incluso para OTRO libro) y ahí seguía, con página y capítulo del
  // fragmento anterior. Con el remonte, `reset()` queda redundante para
  // TODOS los casos (submit y cancelar) y se elimina.
  //
  // No alcanza con que Radix desmonte DialogContent al cerrar: durante la
  // animación de salida sigue montado, y reabrir dentro de esa ventana
  // reusaría la instancia vieja.
  const [aperturas, setAperturas] = React.useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(siguiente) => {
        if (siguiente) setAperturas((n) => n + 1);
        setOpen(siguiente);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="gold">
          <MessageSquareQuote className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <ShareQuoteForm key={aperturas} books={books} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ShareQuoteForm({ books, onClose }: { books: ShareableBook[]; onClose: () => void }) {
  const [bookId, setBookId] = React.useState(books[0]?.id ?? "");
  const [content, setContent] = React.useState("");
  const [page, setPage] = React.useState("");
  const [chapter, setChapter] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const hasBooks = books.length > 0;

  async function handleSubmit() {
    if (!bookId || content.trim().length < 3) return;
    setSubmitting(true);
    try {
      await createQuote({
        bookId,
        content: content.trim(),
        page: page ? Number(page) : null,
        chapter: chapter ? Number(chapter) : null,
      });
      toast.success("Frase compartida");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo compartir la frase");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Comparte una frase</DialogTitle>
        <DialogDescription>
          De un libro de tus estanterías o el que lee el club ahora.
        </DialogDescription>
      </DialogHeader>

      {hasBooks ? (
        <div className="space-y-4">
          <Field>
            <Label htmlFor="quote-book">Libro</Label>
            <Select id="quote-book" value={bookId} onChange={(e) => setBookId(e.target.value)}>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="quote-content">La frase</Label>
            <Textarea
              id="quote-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Copia el fragmento que quieres compartir…"
              rows={4}
              maxLength={500}
            />
            <FieldDescription>{content.length}/500</FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="quote-page" optional>
                Página
              </Label>
              <Input
                id="quote-page"
                type="number"
                inputMode="numeric"
                min={1}
                value={page}
                onChange={(e) => setPage(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="quote-chapter" optional>
                Capítulo
              </Label>
              <Input
                id="quote-chapter"
                type="number"
                inputMode="numeric"
                min={1}
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              />
            </Field>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Agrega un libro a tu estantería para poder citarlo aquí.
        </p>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !hasBooks || !bookId || content.trim().length < 3}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Compartir
        </Button>
      </DialogFooter>
    </>
  );
}
