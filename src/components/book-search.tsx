"use client";

import * as React from "react";
import { Loader2, Search, BookPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { BookCover } from "@/components/book-cover";
import { searchBooksAction } from "@/server/actions/books";
import { suggestBook } from "@/server/actions/suggestions";
import type { BookCandidate } from "@/lib/google-books";

interface BookSearchProps {
  roundId: string;
  onSuggested?: () => void;
}

export function BookSearch({ roundId, onSuggested }: BookSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BookCandidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<BookCandidate | null>(null);
  const [pitch, setPitch] = React.useState("");
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
      } catch (err) {
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
      await suggestBook({
        roundId,
        title: selected.title,
        authors: selected.authors,
        coverUrl: selected.coverUrl,
        description: selected.description,
        pageCount: selected.pageCount,
        publishedYear: selected.publishedYear,
        googleBooksId: selected.googleBooksId,
        isbn: selected.isbn,
        pitch: pitch || undefined,
      });
      toast.success(`Sugerencia enviada: ${selected.title}`);
      setSelected(null);
      setPitch("");
      setQuery("");
      setResults([]);
      onSuggested?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al sugerir";
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
          <div className="flex-1 min-w-0">
            <h4 className="display text-xl leading-tight">{selected.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.authors.join(", ") || "Autor desconocido"}
              {selected.publishedYear ? ` · ${selected.publishedYear}` : ""}
              {selected.pageCount ? ` · ${selected.pageCount} pp.` : ""}
            </p>
            {selected.description ? (
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground/90">
                {selected.description}
              </p>
            ) : null}
          </div>
        </div>

        <Field>
          <Label htmlFor="pitch" optional>¿Por qué lo recomiendas?</Label>
          <Textarea
            id="pitch"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="Una frase que enamore al club…"
            maxLength={800}
            rows={3}
          />
          <FieldDescription>
            Lo verán las demás miembras al votar.
          </FieldDescription>
        </Field>

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => setSelected(null)} className="sm:mr-auto">
            Buscar otro
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookPlus className="h-4 w-4" />
            )}
            Sugerir este libro
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
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-2 -mr-2">
          {results.map((book) => (
            <li key={book.googleBooksId}>
              <button
                type="button"
                onClick={() => setSelected(book)}
                className="group flex w-full gap-3 rounded-xl border border-transparent bg-muted/30 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <BookCover src={book.coverUrl} title={book.title} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-snug line-clamp-2">{book.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {book.authors.join(", ") || "Autor desconocido"}
                    {book.publishedYear ? ` · ${book.publishedYear}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : query.length >= 2 && !searching ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Sin resultados. Prueba otro título.
        </p>
      ) : (
        <p className="text-center text-xs uppercase tracking-[0.24em] text-muted-foreground py-6">
          ✦ Empieza a escribir el título o autor ✦
        </p>
      )}
    </div>
  );
}
