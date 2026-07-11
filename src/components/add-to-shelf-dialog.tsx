"use client";

import * as React from "react";
import { BookPlus, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { ShelfStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/book-cover";
import { searchBooksAction } from "@/server/actions/books";
import { addBookToShelf } from "@/server/actions/shelves";
import { cn } from "@/lib/utils";
import type { BookCandidate } from "@/lib/google-books";

const STATUS_OPTIONS: { value: ShelfStatus; label: string }[] = [
  { value: "WANT_TO_READ", label: "Quiero leer" },
  { value: "READING", label: "Leyendo" },
  { value: "FINISHED", label: "Leído" },
];

interface AddToShelfDialogProps {
  defaultStatus?: ShelfStatus;
  triggerLabel?: string;
}

export function AddToShelfDialog({
  defaultStatus = "WANT_TO_READ",
  triggerLabel = "Agregar libro",
}: AddToShelfDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agrega un libro a tu estantería</DialogTitle>
          <DialogDescription>
            Búscalo en Google Books y elige en qué estantería lo quieres.
          </DialogDescription>
        </DialogHeader>
        <ShelfBookSearch defaultStatus={defaultStatus} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ShelfBookSearch({
  defaultStatus,
  onAdded,
}: {
  defaultStatus: ShelfStatus;
  onAdded?: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BookCandidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<BookCandidate | null>(null);
  const [status, setStatus] = React.useState<ShelfStatus>(defaultStatus);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!query || query.length < 2) {
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
  }, [query]);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await addBookToShelf({
        title: selected.title,
        authors: selected.authors,
        coverUrl: selected.coverUrl,
        description: selected.description,
        pageCount: selected.pageCount,
        publishedYear: selected.publishedYear,
        googleBooksId: selected.googleBooksId,
        isbn: selected.isbn,
        status,
      });
      toast.success(`Agregado a tu estantería: ${selected.title}`);
      setSelected(null);
      setQuery("");
      setResults([]);
      onAdded?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al agregar el libro";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex gap-4 rounded-xl border border-border/70 bg-card/60 p-4">
          <BookCover src={selected.coverUrl} title={selected.title} size="md" />
          <div className="min-w-0 flex-1">
            <h4 className="display text-xl leading-tight">{selected.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.authors.join(", ") || "Autor desconocido"}
              {selected.publishedYear ? ` · ${selected.publishedYear}` : ""}
              {selected.pageCount ? ` · ${selected.pageCount} pp.` : ""}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            ¿En qué estantería?
          </span>
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/50 p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                aria-pressed={status === opt.value}
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                  status === opt.value
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => setSelected(null)} className="sm:mr-auto">
            Buscar otro
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookPlus className="h-4 w-4" />}
            Agregar a mi estantería
          </Button>
        </div>
      </div>
    );
  }

  return (
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
        <ul className="-mr-2 max-h-[420px] space-y-2 overflow-y-auto pr-2">
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin resultados. Prueba otro título.
        </p>
      ) : (
        <p className="py-6 text-center text-xs uppercase tracking-[0.24em] text-muted-foreground">
          ✦ Empieza a escribir el título o autor ✦
        </p>
      )}
    </div>
  );
}
