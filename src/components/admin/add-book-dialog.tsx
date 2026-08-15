"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, BookPlus, Camera, Loader2, Plus, Search } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { BookCover } from "@/components/book-cover";
import { createBook, searchBooksAction } from "@/server/actions/books";
import { optimizarPortada } from "@/lib/image-optimizer";
import { cn } from "@/lib/utils";
import type { BookCandidate } from "@/lib/google-books";
import { ejecutarBusqueda, type EstadoBusqueda } from "@/lib/book-search-state";

type Modo = "buscar" | "manual";
type Paso = "origen" | "revisar";

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
  // llenar la próxima vez que se abre — y esta vez incluye en qué paso del
  // wizard se quedó.
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

// Campos editables del paso 2. Viven separados del estado de búsqueda del
// paso 1 porque el wizard es EL MISMO formulario tanto si el origen fue un
// candidato de la API como si fue "a mano" — ahí es donde se corrigen los
// datos sucios que traen Google Books / Open Library.
interface CamposLibro {
  title: string;
  authors: string;
  publisher: string;
  pageCount: string;
  publishedYear: string;
  isbn: string;
  description: string;
}

const CAMPOS_VACIOS: CamposLibro = {
  title: "",
  authors: "",
  publisher: "",
  pageCount: "",
  publishedYear: "",
  isbn: "",
  description: "",
};

function AddBookForm({
  hayRondaAbierta,
  onClose,
}: {
  hayRondaAbierta: boolean;
  onClose: () => void;
}) {
  const [paso, setPaso] = React.useState<Paso>("origen");
  const [modo, setModo] = React.useState<Modo>("buscar");
  const [marcarComoActual, setMarcarComoActual] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Paso 1 — modo "Buscar"
  const [query, setQuery] = React.useState("");
  const [estado, setEstado] = React.useState<EstadoBusqueda>({ tipo: "vacio" });

  // Paso 2 — campos editables. Se precargan al elegir un candidato de la
  // búsqueda; quedan vacíos si el origen es "a mano".
  const [campos, setCampos] = React.useState<CamposLibro>(CAMPOS_VACIOS);
  const [googleBooksId, setGoogleBooksId] = React.useState<string | null>(null);
  // Portada que trajo la API para el candidato elegido. Es la que se usa
  // como coverUrl si la moderadora no sube un archivo propio encima.
  const [candidatoCoverUrl, setCandidatoCoverUrl] = React.useState<string | null>(null);
  // Archivo elegido a mano, con su preview local. OJO: acá solo se guarda y
  // se previsualiza — la subida real (optimizar + firmar + PUT) pasa recién
  // al confirmar el wizard completo, porque hasta ese momento no hay libro
  // creado contra el cual valga la pena subir nada.
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const buscar = React.useCallback(async (q: string) => {
    setEstado({ tipo: "buscando" });
    setEstado(await ejecutarBusqueda(q, searchBooksAction));
  }, []);

  React.useEffect(() => {
    if (modo !== "buscar" || !query || query.length < 2) {
      setEstado({ tipo: "vacio" });
      return;
    }
    const handle = setTimeout(() => buscar(query), 350);
    return () => clearTimeout(handle);
  }, [modo, query, buscar]);

  // Libera el objectURL del preview cada vez que cambia (o al desmontar el
  // form al cerrar el diálogo). Sin esto la imagen elegida se queda viva en
  // memoria del navegador aunque se reemplace por otra o se cancele todo.
  React.useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  function irARevisarConCandidato(book: BookCandidate) {
    setCampos({
      title: book.title,
      authors: book.authors.join(", "),
      publisher: "",
      pageCount: book.pageCount ? String(book.pageCount) : "",
      publishedYear: book.publishedYear ? String(book.publishedYear) : "",
      isbn: book.isbn ?? "",
      description: book.description ?? "",
    });
    setGoogleBooksId(book.googleBooksId);
    setCandidatoCoverUrl(book.coverUrl);
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setPaso("revisar");
  }

  function irARevisarAMano() {
    // No toca `campos`: si ya arrancó vacío (primera vez), sigue vacío. Si
    // se llega acá volviendo de "Atrás" con algo ya corregido, se conserva
    // — "a mano" solo corta el vínculo con el candidato de la API, no borra
    // lo que la moderadora ya escribió.
    setGoogleBooksId(null);
    setCandidatoCoverUrl(null);
    setPaso("revisar");
  }

  function handleCoverFile(file: File) {
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  }

  function actualizarCampo<K extends keyof CamposLibro>(campo: K, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  }

  const tituloValido = campos.title.trim().length > 0;

  async function handleSubmit() {
    if (!tituloValido) return;
    setSubmitting(true);
    try {
      let coverUrl = candidatoCoverUrl;

      if (coverFile) {
        // La portada se optimiza en el navegador ANTES de pedir la firma:
        // el `size` que viaja en la solicitud es el del archivo YA
        // optimizado, porque el backend lo usa como ContentLength y el
        // storage rechaza con 403 cualquier PUT que traiga más bytes de los
        // declarados.
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

        coverUrl = publicUrl;
      }

      const libro = await createBook({
        title: campos.title.trim(),
        authors: campos.authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        coverUrl,
        description: campos.description.trim() || null,
        pageCount: campos.pageCount ? Number(campos.pageCount) : null,
        publishedYear: campos.publishedYear ? Number(campos.publishedYear) : null,
        googleBooksId,
        isbn: campos.isbn.trim() || null,
        publisher: campos.publisher.trim() || null,
        marcarComoActual,
      });
      toast.success(`Agregado al catálogo: ${libro.title}`);
      onClose();
    } catch (err) {
      // Si la subida de portada falla, el catch corta acá y createBook ni
      // se llama: no queremos un libro a medias sin la portada que se pidió.
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
          {paso === "origen"
            ? "Búscalo en Google Books o cárgalo a mano si no aparece."
            : "Revisa y corrige los datos antes de guardarlo."}
        </DialogDescription>
      </DialogHeader>

      {paso === "origen" ? (
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
                {estado.tipo === "buscando" ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              {estado.tipo === "resultados" ? (
                <>
                  {estado.degradado ? (
                    <p className="text-[11px] text-muted-foreground">
                      Resultados incompletos — una fuente no respondió.{" "}
                      <button
                        type="button"
                        onClick={() => buscar(query)}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Reintentar
                      </button>
                    </p>
                  ) : null}
                  <ul className="-mr-2 max-h-[300px] space-y-2 overflow-y-auto pr-2">
                    {estado.books.map((book) => (
                      <li key={book.googleBooksId}>
                        <button
                          type="button"
                          onClick={() => irARevisarConCandidato(book)}
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
                </>
              ) : estado.tipo === "error" ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No pudimos completar la búsqueda. Puede ser un problema temporal con
                    Google Books o Open Library — también puedes cargarlo a mano.
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => buscar(query)}>
                    Reintentar
                  </Button>
                </div>
              ) : estado.tipo === "sin-resultados" ? (
                <div className="space-y-2 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sin resultados. Prueba otro título o cárgalo a mano.
                  </p>
                  {estado.degradado ? (
                    <p className="text-[11px] text-muted-foreground">
                      Resultados incompletos — una fuente no respondió. Puede que el libro exista
                      y no lo hayamos encontrado.{" "}
                      <button
                        type="button"
                        onClick={() => buscar(query)}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Reintentar
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : estado.tipo === "vacio" ? (
                <p className="py-5 text-center text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  ✦ Empieza a escribir el título o autor ✦
                </p>
              ) : null}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Carga el libro a mano: en el siguiente paso completas título, autores, editorial y el
              resto de los datos.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3"
            onClick={() => setPaso("origen")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Atrás
          </Button>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <BookCover
                src={coverPreviewUrl ?? candidatoCoverUrl}
                title={campos.title || "Portada"}
                size="md"
              />
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                {coverPreviewUrl ?? candidatoCoverUrl ? "Cambiar portada" : "Subir portada"}
              </Button>
            </div>

            <div className="w-full min-w-0 flex-1 space-y-4">
              <Field>
                <Label htmlFor="b-title" required>Título</Label>
                <Input
                  id="b-title"
                  value={campos.title}
                  onChange={(e) => actualizarCampo("title", e.target.value)}
                  placeholder="Cien años de soledad"
                  autoFocus
                />
              </Field>

              <Field>
                <Label htmlFor="b-authors" optional>Autores</Label>
                <Input
                  id="b-authors"
                  value={campos.authors}
                  onChange={(e) => actualizarCampo("authors", e.target.value)}
                  placeholder="Gabriel García Márquez"
                />
                <FieldDescription>Separa varios autores con comas.</FieldDescription>
              </Field>
            </div>
          </div>

          <Field>
            <Label htmlFor="b-publisher" optional>Editorial</Label>
            <Input
              id="b-publisher"
              value={campos.publisher}
              onChange={(e) => actualizarCampo("publisher", e.target.value)}
              placeholder="Sudamericana"
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
                value={campos.pageCount}
                onChange={(e) => actualizarCampo("pageCount", e.target.value)}
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
                value={campos.publishedYear}
                onChange={(e) => actualizarCampo("publishedYear", e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <Label htmlFor="b-isbn" optional>ISBN</Label>
            <Input
              id="b-isbn"
              value={campos.isbn}
              onChange={(e) => actualizarCampo("isbn", e.target.value)}
              placeholder="978-..."
            />
          </Field>

          <Field>
            <Label htmlFor="b-description" optional>Descripción</Label>
            <Textarea
              id="b-description"
              rows={3}
              value={campos.description}
              onChange={(e) => actualizarCampo("description", e.target.value)}
              placeholder="Sinopsis o notas del libro…"
            />
          </Field>

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
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        {paso === "origen" && modo === "manual" ? (
          <Button onClick={irARevisarAMano}>Continuar</Button>
        ) : null}
        {paso === "revisar" ? (
          <Button onClick={handleSubmit} disabled={submitting || !tituloValido}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookPlus className="h-4 w-4" />}
            Agregar libro
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
