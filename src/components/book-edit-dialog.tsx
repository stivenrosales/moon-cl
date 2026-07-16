"use client";

import * as React from "react";
import { Loader2, Pencil, Search, Check } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { BookCover } from "@/components/book-cover";
import { searchBooksAction, updateBookAction } from "@/server/actions/books";
import type { BookCandidate } from "@/lib/google-books";

interface BookEditDialogProps {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    description: string | null;
    pageCount: number | null;
    publishedYear: number | null;
    isbn: string | null;
  };
}

export function BookEditDialog({ book }: BookEditDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(book.title);
  const [authors, setAuthors] = React.useState(book.authors.join(", "));
  const [coverUrl, setCoverUrl] = React.useState(book.coverUrl ?? "");
  const [description, setDescription] = React.useState(book.description ?? "");
  const [pageCount, setPageCount] = React.useState(book.pageCount?.toString() ?? "");
  const [publishedYear, setPublishedYear] = React.useState(
    book.publishedYear?.toString() ?? "",
  );
  const [isbn, setIsbn] = React.useState(book.isbn ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  const [coverQuery, setCoverQuery] = React.useState("");
  const [coverResults, setCoverResults] = React.useState<BookCandidate[]>([]);
  const [searchingCovers, setSearchingCovers] = React.useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!coverPickerOpen) return;
    const q = coverQuery.trim();
    if (q.length < 2) {
      setCoverResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearchingCovers(true);
      try {
        const items = await searchBooksAction(q);
        setCoverResults(items.filter((b) => !!b.coverUrl));
      } catch {
        toast.error("No se pudo buscar portadas");
      } finally {
        setSearchingCovers(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [coverQuery, coverPickerOpen]);

  function openCoverPicker() {
    setCoverPickerOpen(true);
    setCoverQuery(`${title} ${authors.split(",")[0] ?? ""}`.trim());
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await updateBookAction({
        id: book.id,
        title: title.trim(),
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        coverUrl: coverUrl.trim() || null,
        description: description.trim() || null,
        pageCount: pageCount ? Number(pageCount) : null,
        publishedYear: publishedYear ? Number(publishedYear) : null,
        isbn: isbn.trim() || null,
      });
      toast.success("Libro actualizado");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setCoverPickerOpen(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Editar libro</span>
          <span className="sm:hidden sr-only">Editar libro</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar libro</DialogTitle>
          <DialogDescription>
            Cambia portada, título, autores y demás metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <BookCover src={coverUrl || null} title={title} size="md" />
            <div className="flex flex-col gap-2 min-w-0">
              <Field>
                <Label htmlFor="coverUrl">URL de la portada</Label>
                <Input
                  id="coverUrl"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://…"
                />
                <FieldDescription>
                  Pega un enlace o busca una portada nueva abajo.
                </FieldDescription>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openCoverPicker}
                className="self-start"
              >
                <Search className="h-3.5 w-3.5" />
                Buscar otra portada
              </Button>
            </div>
          </div>

          {coverPickerOpen ? (
            <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3">
              <Input
                value={coverQuery}
                onChange={(e) => setCoverQuery(e.target.value)}
                placeholder="Buscar por título o autor…"
              />
              {searchingCovers ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : coverResults.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[260px] overflow-y-auto">
                  {coverResults.map((b) => (
                    <button
                      key={b.googleBooksId}
                      type="button"
                      onClick={() => {
                        setCoverUrl(b.coverUrl ?? "");
                        setCoverPickerOpen(false);
                      }}
                      className="group flex flex-col items-center gap-1 rounded-lg border border-transparent p-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      title={b.title}
                    >
                      <BookCover src={b.coverUrl} title={b.title} size="sm" />
                      <span className="text-[10px] text-muted-foreground line-clamp-2 text-center">
                        {b.title}
                      </span>
                    </button>
                  ))}
                </div>
              ) : coverQuery.length >= 2 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Sin resultados con portada.
                </p>
              ) : (
                <p className="text-center text-xs uppercase tracking-[0.24em] text-muted-foreground py-2">
                  Escribe al menos 2 caracteres
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCoverPickerOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}

          <Field>
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field>
            <Label htmlFor="authors">Autores</Label>
            <Input
              id="authors"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Separados por coma"
            />
            <FieldDescription>Ej: Yuval Noah Harari, María Pérez</FieldDescription>
          </Field>

          <Field>
            <Label htmlFor="description" optional>Descripción</Label>
            <Textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={8000}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="pageCount" optional>Páginas</Label>
              <Input
                id="pageCount"
                type="number"
                inputMode="numeric"
                min={1}
                max={20000}
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="publishedYear" optional>Año</Label>
              <Input
                id="publishedYear"
                type="number"
                inputMode="numeric"
                min={0}
                max={2100}
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="isbn" optional>ISBN</Label>
              <Input id="isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
