"use client";

import * as React from "react";
import { Camera, Check, Loader2, Pencil, Search } from "lucide-react";
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
import { optimizarPortada } from "@/lib/image-optimizer";
import { searchBooksAction, updateBookAction } from "@/server/actions/books";
import type { BookCandidate } from "@/lib/google-books";
import { ejecutarBusqueda, type EstadoBusqueda } from "@/lib/book-search-state";

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
    publisher: string | null;
  };
}

export function BookEditDialog({ book }: BookEditDialogProps) {
  const [open, setOpen] = React.useState(false);
  // Mismo patrón que ProfileEditDialog / AddBookDialog: el formulario vive
  // en un componente aparte, remontado con `key` en cada apertura.
  // BookEditDialog en sí nunca se desmonta —sigue fijo en el header del
  // libro—, así que si el estado (title, authors, coverUrl, etc.) viviera
  // acá, `useState(book.title)` solo tomaría el valor inicial la PRIMERA
  // vez: tocar campos y cerrar sin guardar los dejaba pisados para la
  // próxima apertura, y encima quedaban desincronizados si `book` cambiaba
  // por un revalidatePath ajeno (otra moderadora editando el mismo libro
  // en paralelo). Remontar con `key={aperturas}` fuerza que el estado se
  // vuelva a derivar de `book` fresco cada vez que se abre.
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
        <Button variant="outline" size="sm" className="shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Editar libro</span>
          <span className="sm:hidden sr-only">Editar libro</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <BookEditForm key={aperturas} book={book} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// De dónde sale la portada que se va a guardar. Existe como estado
// EXPLÍCITO (no derivado de qué variables están en null/undefined) para
// que tanto el código como la UI puedan decir con certeza cuál de las tres
// fuentes posibles es la que gana.
type FuentePortada = "actual" | "busqueda" | "archivo";

function BookEditForm({
  book,
  onClose,
}: {
  book: BookEditDialogProps["book"];
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState(book.title);
  const [authors, setAuthors] = React.useState(book.authors.join(", "));
  const [publisher, setPublisher] = React.useState(book.publisher ?? "");
  const [description, setDescription] = React.useState(book.description ?? "");
  const [pageCount, setPageCount] = React.useState(book.pageCount?.toString() ?? "");
  const [publishedYear, setPublishedYear] = React.useState(
    book.publishedYear?.toString() ?? "",
  );
  const [isbn, setIsbn] = React.useState(book.isbn ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  // Portada. `coverUrl` guarda la URL "de catálogo" (la actual del libro,
  // o la que trajo el buscador de portadas alternativas) — ya NO es un
  // campo de texto editable a mano, que es justo lo que se sacó. El
  // archivo subido vive aparte en `coverFile`/`coverPreviewUrl` con su
  // preview local; si `fuentePortada` es "archivo", gana sobre `coverUrl`
  // al guardar.
  const [coverUrl, setCoverUrl] = React.useState(book.coverUrl ?? "");
  const [fuentePortada, setFuentePortada] = React.useState<FuentePortada>("actual");
  // Igual que en AddBookDialog: el archivo NO se sube al elegirlo, solo se
  // guarda con un preview local. La subida real (optimizar + firmar + PUT)
  // pasa recién en handleSubmit.
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [coverQuery, setCoverQuery] = React.useState("");
  const [estadoPortadas, setEstadoPortadas] = React.useState<EstadoBusqueda>({
    tipo: "vacio",
  });
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);

  const buscarPortadas = React.useCallback(async (q: string) => {
    setEstadoPortadas({ tipo: "buscando" });
    const estado = await ejecutarBusqueda(q, searchBooksAction);
    // Acá el filtro extra es propio de este picker: solo interesan
    // candidatos que traigan portada, a diferencia de book-search.tsx /
    // add-to-shelf-dialog.tsx / add-book-dialog.tsx donde cualquier libro
    // sirve. Si tras filtrar no queda ninguno, cae a "sin-resultados"
    // preservando `degradado` — si no, se reintroduciría acá el mismo bug
    // que este cambio arregla en los otros tres componentes.
    if (estado.tipo === "resultados") {
      const conPortada = estado.books.filter((b) => !!b.coverUrl);
      setEstadoPortadas(
        conPortada.length > 0
          ? { tipo: "resultados", books: conPortada, degradado: estado.degradado }
          : { tipo: "sin-resultados", degradado: estado.degradado },
      );
    } else {
      setEstadoPortadas(estado);
    }
  }, []);

  React.useEffect(() => {
    if (!coverPickerOpen) return;
    const q = coverQuery.trim();
    if (q.length < 2) {
      setEstadoPortadas({ tipo: "vacio" });
      return;
    }
    const handle = setTimeout(() => buscarPortadas(q), 350);
    return () => clearTimeout(handle);
  }, [coverQuery, coverPickerOpen, buscarPortadas]);

  // Libera el objectURL del preview cada vez que cambia (se reemplaza por
  // otro archivo o por otra fuente) o al desmontar el form al cerrar el
  // diálogo. Sin esto la imagen elegida se queda viva en memoria.
  React.useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  function openCoverPicker() {
    setCoverPickerOpen(true);
    setCoverQuery(`${title} ${authors.split(",")[0] ?? ""}`.trim());
  }

  function elegirPortadaDeBusqueda(b: BookCandidate) {
    // Elegir una portada de otra edición es una acción explícita: gana
    // sobre cualquier archivo que se haya subido antes en esta misma
    // sesión de edición.
    setCoverUrl(b.coverUrl ?? "");
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setFuentePortada("busqueda");
    setCoverPickerOpen(false);
  }

  function handleCoverFile(file: File) {
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setFuentePortada("archivo");
  }

  const previewSrc = fuentePortada === "archivo" ? coverPreviewUrl : coverUrl || null;
  const textoFuentePortada =
    fuentePortada === "archivo"
      ? "Archivo nuevo — se sube al confirmar."
      : fuentePortada === "busqueda"
        ? "Portada elegida en la búsqueda — reemplaza a la actual al confirmar."
        : "Portada actual del libro.";

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let coverUrlFinal = coverUrl.trim() || null;

      if (fuentePortada === "archivo" && coverFile) {
        // Igual que en AddBookDialog: se optimiza en el navegador ANTES de
        // pedir la firma, porque el `size` que viaja en la solicitud es el
        // del archivo YA optimizado — el backend lo usa como ContentLength
        // y el storage rechaza con 403 cualquier PUT que traiga más bytes
        // de los declarados.
        const optimizado = await optimizarPortada(coverFile);

        const solicitud = await fetch("/api/cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: optimizado.name,
            contentType: optimizado.type,
            size: optimizado.size,
          }),
        });
        if (!solicitud.ok) {
          const data = (await solicitud.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "No se pudo preparar la subida de la portada");
        }
        const { uploadUrl, publicUrl } = (await solicitud.json()) as {
          uploadUrl: string;
          publicUrl: string;
        };

        const subida = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": optimizado.type },
          body: optimizado,
        });
        if (!subida.ok) {
          throw new Error("No se pudo subir la portada al storage");
        }

        coverUrlFinal = publicUrl;
      }

      await updateBookAction({
        id: book.id,
        title: title.trim(),
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        coverUrl: coverUrlFinal,
        description: description.trim() || null,
        pageCount: pageCount ? Number(pageCount) : null,
        publishedYear: publishedYear ? Number(publishedYear) : null,
        isbn: isbn.trim() || null,
        publisher: publisher.trim() || null,
      });
      toast.success("Libro actualizado");
      onClose();
    } catch (err) {
      // Si la subida de portada falla, el catch corta ACÁ — updateBookAction
      // ni se llama, así que nunca queda una edición a medias.
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar libro</DialogTitle>
        <DialogDescription>
          Cambia portada, título, autores y demás metadata.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-[auto_1fr] gap-4">
          <BookCover src={previewSrc} title={title} size="md" />
          <div className="flex flex-col gap-2 min-w-0">
            <Field>
              <Label optional>Portada</Label>
              <FieldDescription>{textoFuentePortada}</FieldDescription>
            </Field>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCoverFile(file);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="self-start"
              >
                <Camera className="h-3.5 w-3.5" />
                Subir portada
              </Button>
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
        </div>

        {coverPickerOpen ? (
          <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3">
            <Input
              value={coverQuery}
              onChange={(e) => setCoverQuery(e.target.value)}
              placeholder="Buscar por título o autor…"
            />
            {estadoPortadas.tipo === "buscando" ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : estadoPortadas.tipo === "error" ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No pudimos buscar portadas. Puede ser un problema temporal con Google Books
                  o Open Library.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => buscarPortadas(coverQuery.trim())}
                >
                  Reintentar
                </Button>
              </div>
            ) : estadoPortadas.tipo === "resultados" ? (
              <>
                {estadoPortadas.degradado ? (
                  <p className="text-[11px] text-muted-foreground">
                    Resultados incompletos — una fuente no respondió.{" "}
                    <button
                      type="button"
                      onClick={() => buscarPortadas(coverQuery.trim())}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Reintentar
                    </button>
                  </p>
                ) : null}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[260px] overflow-y-auto">
                  {estadoPortadas.books.map((b) => (
                    <button
                      key={b.googleBooksId}
                      type="button"
                      onClick={() => elegirPortadaDeBusqueda(b)}
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
              </>
            ) : estadoPortadas.tipo === "sin-resultados" ? (
              <div className="space-y-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">Sin resultados con portada.</p>
                {estadoPortadas.degradado ? (
                  <p className="text-[11px] text-muted-foreground">
                    Resultados incompletos — una fuente no respondió. Puede que el libro exista y
                    no lo hayamos encontrado.{" "}
                    <button
                      type="button"
                      onClick={() => buscarPortadas(coverQuery.trim())}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Reintentar
                    </button>
                  </p>
                ) : null}
              </div>
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
          <Label htmlFor="publisher" optional>Editorial</Label>
          <Input
            id="publisher"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="Sudamericana"
          />
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
        <Button variant="ghost" onClick={onClose}>
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
    </>
  );
}
