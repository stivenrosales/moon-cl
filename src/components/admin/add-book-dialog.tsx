"use client";

import * as React from "react";
import { AlertTriangle, BookPlus, Loader2, Plus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookCover } from "@/components/book-cover";
import { createBook, searchBooksAction } from "@/server/actions/books";
import { cn } from "@/lib/utils";
import type { BookCandidate } from "@/lib/google-books";

type Modo = "buscar" | "manual";

const MODO_OPTIONS: { value: Modo; label: string }[] = [
  { value: "buscar", label: "Buscar" },
  { value: "manual", label: "A mano" },
];

interface AddBookDialogProps {
  hayRondaAbierta: boolean;
}

export function AddBookDialog({ hayRondaAbierta }: AddBookDialogProps) {
  const [open, setOpen] = React.useState(false);
  // Mismo patrón que ProfileEditDialog: el formulario vive en un componente
  // aparte, remontado con `key` en cada apertura. AddBookDialog en sí nunca
  // se desmonta (vive fijo en el header de "Libros del club"), así que si el
  // estado del form viviera acá, cerrar sin guardar dejaría campos a medio
  // llenar la próxima vez que se abre.
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
        <Button variant="gold" size="sm">
          <Plus className="h-4 w-4" />
          Agregar libro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <AddBookForm
          key={aperturas}
          hayRondaAbierta={hayRondaAbierta}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddBookForm({
  hayRondaAbierta,
  onClose,
}: {
  hayRondaAbierta: boolean;
  onClose: () => void;
}) {
  const [modo, setModo] = React.useState<Modo>("buscar");
  const [marcarComoActual, setMarcarComoActual] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Modo "Buscar"
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BookCandidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<BookCandidate | null>(null);

  // Modo "A mano"
  const [title, setTitle] = React.useState("");
  const [authors, setAuthors] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [pageCount, setPageCount] = React.useState("");
  const [publishedYear, setPublishedYear] = React.useState("");
  const [isbn, setIsbn] = React.useState("");

  React.useEffect(() => {
    if (modo !== "buscar" || !query || query.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await searchBooksAction(query);
        setResults(items);
      } catch {
        toast.error("No se pudo buscar libros");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [modo, query]);

  const manualTitleValido = title.trim().length > 0;
  const puedeEnviar = modo === "buscar" ? selected !== null : manualTitleValido;

  async function handleSubmit() {
    if (!puedeEnviar) return;
    setSubmitting(true);
    try {
      const payload =
        modo === "buscar" && selected
          ? {
              title: selected.title,
              authors: selected.authors,
              coverUrl: selected.coverUrl,
              description: selected.description,
              pageCount: selected.pageCount,
              publishedYear: selected.publishedYear,
              googleBooksId: selected.googleBooksId,
              isbn: selected.isbn,
              marcarComoActual,
            }
          : {
              title: title.trim(),
              authors: authors
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean),
              coverUrl: coverUrl.trim() || null,
              description: null,
              pageCount: pageCount ? Number(pageCount) : null,
              publishedYear: publishedYear ? Number(publishedYear) : null,
              googleBooksId: null,
              isbn: isbn.trim() || null,
              marcarComoActual,
            };

      const libro = await createBook(payload);
      toast.success(`Agregado al catálogo: ${libro.title}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear el libro";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Agrega un libro al catálogo</DialogTitle>
        <DialogDescription>
          Búscalo en Google Books o cárgalo a mano si no aparece.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/50 p-1">
          {MODO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setModo(opt.value)}
              aria-pressed={modo === opt.value}
              className={cn(
                "inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                modo === opt.value
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {modo === "buscar" ? (
          selected ? (
            <div className="flex gap-4 rounded-xl border border-border/70 bg-card/60 p-4">
              <BookCover src={selected.coverUrl} title={selected.title} size="md" />
              <div className="min-w-0 flex-1">
                <h4 className="display text-xl leading-tight">{selected.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.authors.join(", ") || "Autor desconocido"}
                  {selected.publishedYear ? ` · ${selected.publishedYear}` : ""}
                  {selected.pageCount ? ` · ${selected.pageCount} pp.` : ""}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 -ml-3"
                  onClick={() => setSelected(null)}
                >
                  Buscar otro
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Busca por título, autor o ISBN..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
                {searching ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              {results.length > 0 ? (
                <ul className="-mr-2 max-h-[300px] space-y-2 overflow-y-auto pr-2">
                  {results.map((book) => (
                    <li key={book.googleBooksId}>
                      <button
                        type="button"
                        onClick={() => setSelected(book)}
                        className="group flex w-full gap-3 rounded-xl border border-transparent bg-muted/30 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                      >
                        <BookCover src={book.coverUrl} title={book.title} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium leading-snug">{book.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {book.authors.join(", ") || "Autor desconocido"}
                            {book.publishedYear ? ` · ${book.publishedYear}` : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query.length >= 2 && !searching ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin resultados. Prueba otro título o cárgalo a mano.
                </p>
              ) : (
                <p className="py-5 text-center text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  ✦ Empieza a escribir el título o autor ✦
                </p>
              )}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <Field>
              <Label htmlFor="b-title" required>Título</Label>
              <Input
                id="b-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cien años de soledad"
                autoFocus
              />
            </Field>

            <Field>
              <Label htmlFor="b-authors" optional>Autores</Label>
              <Input
                id="b-authors"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Gabriel García Márquez"
              />
              <FieldDescription>Separa varios autores con comas.</FieldDescription>
            </Field>

            <Field>
              <Label htmlFor="b-coverUrl" optional>URL de portada</Label>
              <Input
                id="b-coverUrl"
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field className="min-w-0">
                <Label htmlFor="b-pageCount" optional>Páginas</Label>
                <Input
                  id="b-pageCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value)}
                />
              </Field>
              <Field className="min-w-0">
                <Label htmlFor="b-publishedYear" optional>Año</Label>
                <Input
                  id="b-publishedYear"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2100}
                  value={publishedYear}
                  onChange={(e) => setPublishedYear(e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <Label htmlFor="b-isbn" optional>ISBN</Label>
              <Input
                id="b-isbn"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-..."
              />
            </Field>
          </div>
        )}

        <Checkbox
          checked={marcarComoActual}
          onChange={(e) => setMarcarComoActual(e.currentTarget.checked)}
          label="Marcarlo como lectura en curso del club"
          description="Se muestra en /hoy como el libro que se está leyendo ahora, sin pasar por votación."
        />

        {hayRondaAbierta && marcarComoActual ? (
          <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 translate-y-0.5" />
            <p>
              Hay una ronda de votación abierta ahora mismo. Cuando cierre —el cron se encarga
              solo, al llegar la fecha límite— el libro que gane la votación va a reemplazar a
              este como lectura en curso, y este va a quedar archivado como leído.
            </p>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || !puedeEnviar}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookPlus className="h-4 w-4" />}
          Agregar libro
        </Button>
      </DialogFooter>
    </>
  );
}
